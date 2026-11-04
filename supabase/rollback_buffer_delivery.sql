-- ROLLBACK for buffer_delivery_setup.sql (Penghantaran Extra) and, if it was run,
-- buffer_delivery_backfill.sql. Puts the database back to the "Dihantar Lebih" state
-- (extra_delivery_setup.sql): over-delivery is allowed but NOT charged.
--
-- WHAT IT DOES (all in one transaction, so it either fully applies or not at all):
--  1. Deletes every buffer delivery (is_buffer) and every extra-only line (is_extra,
--     ordered 0). Those cartons disappear from the orders.
--  2. Re-prices over-delivered lines back to ordered x price, and re-totals the
--     affected orders (this also undoes the backfill).
--  3. Recomputes "completed" for orders that had buffer deliveries.
--  4. Restores the previous record_delivery() and the original table rules, then
--     drops record_buffer_delivery, remove_buffer_batch, recompute_order and the
--     is_buffer / is_extra columns.
--
-- If the site code with the "Penghantaran Extra" button has already been pushed, roll
-- the site back first (Netlify > Deploys > previous deploy > Publish deploy), because
-- it selects the columns this script drops.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

begin;

-- orders that held buffer data: their completion must be recomputed afterwards
create temp table _rb_buffer_orders on commit drop as
  select distinct ol.order_id
  from order_lines ol
  where ol.is_extra
     or exists (select 1 from delivery_batches db where db.order_line_id = ol.id and db.is_buffer);

-- 1. remove buffer data
delete from delivery_batches where is_buffer;
delete from order_lines where is_extra;   -- any batches on them go too (on delete cascade)

-- 2. every line goes back to ordered x price (no charge for extra cartons). Only lines
--    whose value differs are touched, i.e. those charged for extra cartons.
create temp table _rb_reprice_orders on commit drop as
  select distinct ol.order_id
  from order_lines ol
  where ol.line_value <> ol.cartons_ordered * ol.carton_price_snapshot;

update order_lines ol
  set line_value = ol.cartons_ordered * ol.carton_price_snapshot
  where ol.line_value <> ol.cartons_ordered * ol.carton_price_snapshot;

update orders o
  set total = coalesce((select sum(line_value) from order_lines where order_id = o.id), 0)
  where o.id in (select order_id from _rb_reprice_orders union select order_id from _rb_buffer_orders);

-- 3. completion for orders that had buffer deliveries: complete only if EVERY line
--    has delivered >= ordered (the Dihantar Lebih rule)
update orders o
  set completed_date = case
        when not exists (
          select 1 from order_lines ol
          where ol.order_id = o.id
            and coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = ol.id), 0) < ol.cartons_ordered
        ) then (
          select max(db.delivered_date) from delivery_batches db
            join order_lines ol on ol.id = db.order_line_id where ol.order_id = o.id
        )
        else null end
  where o.id in (select order_id from _rb_buffer_orders);

-- 4a. previous record_delivery (verbatim from extra_delivery_setup.sql)
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
  v_all_full boolean;
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

  select not exists (
    select 1 from order_lines ol
    where ol.order_id = p_order_id
      and coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = ol.id), 0) < ol.cartons_ordered
  ) into v_all_full;
  select max(db.delivered_date) into v_max_delivered_date
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;

  update orders
    set completed_date = case when v_all_full
                               then v_max_delivered_date
                               else null end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;
grant execute on function record_delivery(uuid, jsonb) to authenticated;

-- 4b. remove the buffer functions and helper
drop function if exists record_buffer_delivery(uuid, date, jsonb);
drop function if exists remove_buffer_batch(uuid);
drop function if exists recompute_order(uuid);

-- 4c. original table rules (see supabase/schema.sql history)
alter table order_lines drop constraint if exists order_lines_ordered_or_extra_check;
alter table order_lines drop constraint if exists order_lines_cartons_ordered_check;
alter table order_lines add constraint order_lines_cartons_ordered_check check (cartons_ordered > 0);
alter table order_lines drop column if exists is_extra;

alter table delivery_batches drop constraint if exists delivery_batches_batch_no_check;
alter table delivery_batches add constraint delivery_batches_batch_no_check check (batch_no in (1, 2));
alter table delivery_batches drop column if exists is_buffer;

commit;
