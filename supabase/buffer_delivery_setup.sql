-- Penghantaran Extra (buffer stock): items CK sends without an order.
--  * record_buffer_delivery(): operator keys outlet + products + cartons + date
--    + expiry. Cartons first knock off what the outlet still owes for that
--    product (latest order first, then older). Anything beyond that lands on
--    the outlet's latest order as extra (Dihantar Lebih on an existing line,
--    or a new "extra" line with ordered 0), and is charged.
--  * Charging rule everywhere: line_value = max(ordered, delivered) x price.
--  * remove_buffer_batch(): undo a buffer entry.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
-- NOTE: this does NOT change any existing order's total. Run
-- buffer_delivery_backfill.sql separately only if you want past over-deliveries charged.

-- 1. Batches: allow more than 2 per line (buffer batches use 3, 4, ...) + flag
alter table delivery_batches drop constraint if exists delivery_batches_batch_no_check;
alter table delivery_batches add constraint delivery_batches_batch_no_check check (batch_no >= 1);
alter table delivery_batches add column if not exists is_buffer boolean not null default false;

-- 2. Lines: a buffer product not on the order is a line with ordered 0
alter table order_lines add column if not exists is_extra boolean not null default false;
alter table order_lines drop constraint if exists order_lines_cartons_ordered_check;
alter table order_lines drop constraint if exists order_lines_ordered_or_extra_check;
alter table order_lines add constraint order_lines_ordered_or_extra_check
  check (cartons_ordered > 0 or (is_extra and cartons_ordered = 0));

-- 3. Internal helper: re-price every line, re-total the order, recompute completion.
-- Complete only when EVERY line has delivered >= ordered.
create or replace function recompute_order(p_order_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_all_full boolean;
  v_max_delivered_date date;
begin
  update order_lines ol
    set line_value = greatest(
          ol.cartons_ordered,
          coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = ol.id), 0)
        ) * ol.carton_price_snapshot
    where ol.order_id = p_order_id;

  select not exists (
    select 1 from order_lines ol
    where ol.order_id = p_order_id
      and coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = ol.id), 0) < ol.cartons_ordered
  ) into v_all_full;
  select max(db.delivered_date) into v_max_delivered_date
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;

  update orders
    set total = coalesce((select sum(line_value) from order_lines where order_id = p_order_id), 0),
        completed_date = case when v_all_full then v_max_delivered_date else null end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function recompute_order(uuid) from public, anon, authenticated;

-- 4. record_delivery: same behaviour as before, but the final block now
-- re-prices (over-delivery is charged) and empty extra lines are removed.
create or replace function record_delivery(p_order_id uuid, p_lines jsonb)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_line jsonb;
  v_ol order_lines%rowtype;
  v_q1 integer; v_q2 integer;
  v_e1 date; v_e2 date;
  v_dd1 date; v_dd2 date;
begin
  if not is_operator() then
    raise exception 'Only operators can record deliveries';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_order.cancelled then raise exception 'Cannot record delivery on a cancelled order'; end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_ol from order_lines
      where id = (v_line->>'order_line_id')::uuid and order_id = p_order_id;
    if not found then
      raise exception 'Order line % is not part of this order', v_line->>'order_line_id';
    end if;

    v_q1 := greatest(0, coalesce((v_line->>'batch1_qty')::integer, 0));
    v_q2 := greatest(0, coalesce((v_line->>'batch2_qty')::integer, 0));
    v_e1 := nullif(v_line->>'batch1_expiry', '')::date;
    v_e2 := nullif(v_line->>'batch2_expiry', '')::date;
    v_dd1 := coalesce(nullif(v_line->>'batch1_delivered_date', '')::date, current_date);
    v_dd2 := coalesce(nullif(v_line->>'batch2_delivered_date', '')::date, current_date);

    if v_q1 > 0 and (v_dd1 < v_order.order_date or v_dd1 > current_date) then
      raise exception 'Batch 1 delivered date for line % must be between the order date and today', v_ol.id;
    end if;
    if v_q2 > 0 and (v_dd2 < v_order.order_date or v_dd2 > current_date) then
      raise exception 'Batch 2 delivered date for line % must be between the order date and today', v_ol.id;
    end if;

    if v_q1 > 0 then
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by)
      values (v_ol.id, 1, v_q1, v_e1, v_dd1, auth.uid())
      on conflict (order_line_id, batch_no) do update
        set qty = excluded.qty, expiry_date = excluded.expiry_date,
            delivered_date = excluded.delivered_date,
            recorded_at = now(), recorded_by = excluded.recorded_by;
    else
      delete from delivery_batches where order_line_id = v_ol.id and batch_no = 1;
    end if;

    if v_q2 > 0 then
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by)
      values (v_ol.id, 2, v_q2, v_e2, v_dd2, auth.uid())
      on conflict (order_line_id, batch_no) do update
        set qty = excluded.qty, expiry_date = excluded.expiry_date,
            delivered_date = excluded.delivered_date,
            recorded_at = now(), recorded_by = excluded.recorded_by;
    else
      delete from delivery_batches where order_line_id = v_ol.id and batch_no = 2;
    end if;
  end loop;

  -- an extra line left with no deliveries at all is just clutter
  delete from order_lines ol
    where ol.order_id = p_order_id and ol.is_extra
      and not exists (select 1 from delivery_batches db where db.order_line_id = ol.id);

  v_order := recompute_order(p_order_id);
  return v_order;
end;
$$;
grant execute on function record_delivery(uuid, jsonb) to authenticated;

-- 5. Buffer delivery. p_lines: [{"product_id": uuid, "cartons": int, "expiry": date|null}]
-- All-or-nothing. Returns a jsonb summary of where every carton went.
create or replace function record_buffer_delivery(p_outlet_id uuid, p_delivered_date date, p_lines jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_date date := coalesce(p_delivered_date, current_date);
  v_line jsonb;
  v_product products%rowtype;
  v_cartons integer;
  v_expiry date;
  v_left integer;
  v_owed integer;
  v_take integer;
  v_batch_no integer;
  v_ol order_lines%rowtype;
  v_latest orders;
  v_order_no text;
  v_kind text;
  v_knocked jsonb;
  v_extra jsonb;
  v_touched uuid[] := '{}';
  v_summary jsonb := '[]'::jsonb;
  v_id uuid;
begin
  if not is_operator() then
    raise exception 'Only operators can record deliveries';
  end if;
  if not exists (select 1 from outlets where id = p_outlet_id) then
    raise exception 'Outlet not found';
  end if;
  if v_date > current_date then
    raise exception 'Delivery date cannot be in the future';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item';
  end if;

  -- where leftover cartons land: the outlet's latest order not dated after the delivery
  select * into v_latest from orders
    where outlet_id = p_outlet_id and not cancelled and order_date <= v_date
    order by order_date desc, created_at desc
    limit 1;
  if not found then
    raise exception 'This outlet has no order on or before that date to attach the delivery to';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_cartons := (v_line->>'cartons')::integer;
    if v_cartons is null or v_cartons <= 0 then
      raise exception 'Cartons must be more than 0';
    end if;
    select * into v_product from products
      where id = (v_line->>'product_id')::uuid and active;
    if not found then
      raise exception 'Unknown or inactive product %', v_line->>'product_id';
    end if;
    v_expiry := nullif(v_line->>'expiry', '')::date;
    v_left := v_cartons;
    v_knocked := '[]'::jsonb;
    v_extra := null;

    -- knock off what is still owed: newest order first, then older
    for v_ol in
      select ol.* from order_lines ol join orders o on o.id = ol.order_id
      where o.outlet_id = p_outlet_id and not o.cancelled and o.order_date <= v_date
        and ol.product_id = v_product.id
      order by o.order_date desc, o.created_at desc, ol.created_at
    loop
      exit when v_left <= 0;
      v_owed := v_ol.cartons_ordered
        - coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = v_ol.id), 0);
      continue when v_owed <= 0;
      v_take := least(v_left, v_owed);

      select greatest(2, coalesce(max(batch_no), 0)) + 1 into v_batch_no
        from delivery_batches where order_line_id = v_ol.id;
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by, is_buffer)
      values (v_ol.id, v_batch_no, v_take, v_expiry, v_date, auth.uid(), true);

      select order_no into v_order_no from orders where id = v_ol.order_id;
      v_knocked := v_knocked || jsonb_build_object('order_no', v_order_no, 'cartons', v_take, 'was_owed', v_owed);
      if not (v_ol.order_id = any(v_touched)) then v_touched := v_touched || v_ol.order_id; end if;
      v_left := v_left - v_take;
    end loop;

    -- leftover: beyond everything owed, so it is extra on the latest order
    if v_left > 0 then
      select * into v_ol from order_lines
        where order_id = v_latest.id and product_id = v_product.id
        order by created_at limit 1;
      if found then
        v_kind := 'dihantar_lebih';
      else
        insert into order_lines (
          order_id, product_id, cartons_ordered,
          unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value, is_extra
        ) values (
          v_latest.id, v_product.id, 0,
          v_product.unit_price, v_product.units_per_carton,
          v_product.unit_price * v_product.units_per_carton, 0, true
        ) returning * into v_ol;
        v_kind := 'penghantaran_extra';
      end if;

      select greatest(2, coalesce(max(batch_no), 0)) + 1 into v_batch_no
        from delivery_batches where order_line_id = v_ol.id;
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by, is_buffer)
      values (v_ol.id, v_batch_no, v_left, v_expiry, v_date, auth.uid(), true);

      v_extra := jsonb_build_object('order_no', v_latest.order_no, 'cartons', v_left, 'kind', v_kind);
      if not (v_latest.id = any(v_touched)) then v_touched := v_touched || v_latest.id; end if;
    end if;

    v_summary := v_summary || jsonb_build_object(
      'product', v_product.name, 'cartons', v_cartons, 'knocked_off', v_knocked, 'extra', v_extra);
  end loop;

  foreach v_id in array v_touched loop
    perform recompute_order(v_id);
  end loop;

  return v_summary;
end;
$$;
grant execute on function record_buffer_delivery(uuid, date, jsonb) to authenticated;

-- 6. Undo a buffer entry (only batches created by record_buffer_delivery).
create or replace function remove_buffer_batch(p_batch_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_b delivery_batches;
  v_ol order_lines%rowtype;
begin
  if not is_operator() then
    raise exception 'Only operators can record deliveries';
  end if;
  select * into v_b from delivery_batches where id = p_batch_id;
  if not found then raise exception 'Delivery not found'; end if;
  if not v_b.is_buffer then
    raise exception 'Only buffer deliveries can be removed here';
  end if;
  select * into v_ol from order_lines where id = v_b.order_line_id;

  delete from delivery_batches where id = p_batch_id;
  if v_ol.is_extra and not exists (select 1 from delivery_batches where order_line_id = v_ol.id) then
    delete from order_lines where id = v_ol.id;
  end if;

  return recompute_order(v_ol.order_id);
end;
$$;
grant execute on function remove_buffer_batch(uuid) to authenticated;
