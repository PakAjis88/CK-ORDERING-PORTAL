-- ROLLBACK for delivery_staff_setup.sql (delivery staff role).
--
-- WHAT IT DOES (one transaction: fully applies or not at all):
--  1. Deletes every delivery entry made by delivery staff (batches with a drop) and any
--     extra line left empty by that, then re-totals the affected orders.
--     Deliveries entered by operators (normal / Penghantaran Extra button) are NOT touched.
--  2. Deletes the profiles of delivery logins, so those logins can no longer use the app.
--     (The login itself stays in Supabase > Authentication > Users; delete it there if wanted.)
--  3. Drops the staff functions, the photo policies, the drops table and the two extra
--     batch columns, and restores the original role list.
-- The "delivery-photos" bucket and the photos in it are left in place (Supabase does not
-- allow deleting storage objects from SQL; delete them in Storage if you want them gone).
-- If the site code with the Delivery screens has already been pushed, roll the site back
-- first (Netlify > Deploys > previous deploy > Publish deploy).
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

begin;

create temp table _rb_delivery_orders on commit drop as
  select distinct ol.order_id
  from delivery_batches db join order_lines ol on ol.id = db.order_line_id
  where db.drop_id is not null;

delete from delivery_batches where drop_id is not null;
delete from order_lines ol
  where ol.is_extra
    and not exists (select 1 from delivery_batches db where db.order_line_id = ol.id);

-- orders created automatically for a delivery without an order that are now empty
delete from orders o
  where o.auto_extra and not exists (select 1 from order_lines ol where ol.order_id = o.id);

select recompute_order(order_id) from _rb_delivery_orders;

delete from user_profiles where role = 'delivery';

drop policy if exists "delivery photos staff insert" on storage.objects;
drop policy if exists "delivery photos staff read" on storage.objects;
drop policy if exists "delivery photos operator delete" on storage.objects;

-- the operator's Penghantaran Extra function goes back to its original form (no auto orders)
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

-- ...and so does remove_buffer_batch
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

drop function if exists preview_staff_delivery(uuid, jsonb);
drop function if exists set_delivery_gallery(boolean);
drop function if exists delivery_gallery_enabled();
delete from app_settings where key = 'delivery_gallery';
drop function if exists record_staff_delivery(uuid, jsonb, uuid, text);
drop function if exists correct_delivery_entry(uuid, uuid, integer, date);
drop function if exists list_deliveries(date, date, uuid);
drop function if exists _allocate_staff_entry(uuid, uuid, integer, date, date, uuid);
drop function if exists _extra_target_order(uuid, date);
-- auto orders that the operator's Penghantaran Extra button created keep their lines and become ordinary orders
alter table orders drop column if exists auto_extra;
drop function if exists is_delivery();
drop function if exists kl_week_start();
drop function if exists kl_today();

drop index if exists idx_delivery_batches_drop;
alter table delivery_batches drop column if exists drop_id;
alter table delivery_batches drop column if exists is_extra_part;
drop table if exists delivery_drops;

alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('outlet', 'operator', 'admin', 'halal'));

commit;
