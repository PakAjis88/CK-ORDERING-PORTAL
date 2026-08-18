-- ============================================================================
-- Per-batch delivery date
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Adds delivered_date to delivery_batches — the real physical delivery
-- date, operator-entered, distinct from recorded_at (system audit
-- timestamp of when the row was written) and expiry_date (product expiry,
-- unrelated to delivery timing). record_delivery() now recomputes
-- orders.completed_date as max(delivered_date) across the order's batches
-- (not current_date) whenever it's called — so correcting a delivered_date
-- after the fact correctly re-derives the "Done" vs "Done (late)" status.
-- ============================================================================

alter table delivery_batches add column if not exists delivered_date date;
update delivery_batches set delivered_date = recorded_at::date where delivered_date is null;
alter table delivery_batches alter column delivered_date set default current_date;
alter table delivery_batches alter column delivered_date set not null;

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
  v_ordered_total integer;
  v_delivered_total integer;
  v_max_delivered_date date;
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
    if v_q1 + v_q2 > v_ol.cartons_ordered then
      raise exception 'Delivered quantity for line % exceeds cartons ordered', v_ol.id;
    end if;
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

  select coalesce(sum(cartons_ordered), 0) into v_ordered_total
    from order_lines where order_id = p_order_id;
  select coalesce(sum(db.qty), 0) into v_delivered_total
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;
  select max(db.delivered_date) into v_max_delivered_date
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;

  update orders
    set completed_date = case when v_delivered_total >= v_ordered_total
                               then v_max_delivered_date
                               else null end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

grant execute on function record_delivery(uuid, jsonb) to authenticated;
