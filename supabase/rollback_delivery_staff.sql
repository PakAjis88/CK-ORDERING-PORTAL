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

select recompute_order(order_id) from _rb_delivery_orders;

delete from user_profiles where role = 'delivery';

drop policy if exists "delivery photos staff insert" on storage.objects;
drop policy if exists "delivery photos staff read" on storage.objects;
drop policy if exists "delivery photos operator delete" on storage.objects;

drop function if exists record_staff_delivery(uuid, jsonb, uuid, text);
drop function if exists correct_delivery_entry(uuid, uuid, integer, date);
drop function if exists list_deliveries(date, date, uuid);
drop function if exists _allocate_staff_entry(uuid, uuid, integer, date, date, uuid);
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
