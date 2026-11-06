-- ============================================================================
-- Delivery staff ("delivery" role): daily delivery-out entry with a photo.
--  * A delivery login is NOT an operator: it cannot read orders, stock, HMS,
--    costs or users. It only sees products/outlets and calls the functions below.
--  * record_staff_delivery(): outlet + products (cartons, expiry) + ONE photo per
--    outlet visit ("drop"). Cartons knock off what the outlet still owes,
--    OLDEST order first. Anything beyond everything owed lands on the outlet's
--    latest order as extra (Dihantar Lebih on an existing line, or a new extra
--    line = Penghantaran Extra), marked and charged at the carton price.
--  * correct_delivery_entry(): change/remove one product entry of a drop. Delivery
--    staff: only entries dated in the current Mon-Sun week (Malaysia time).
--    Operators / admins / HMS: any time.
--  * list_deliveries(): the delivery log (for the screen and the Excel/PDF reports).
--  * Private storage bucket "delivery-photos" (one compressed JPEG per drop).
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
-- Undo: supabase/rollback_delivery_staff.sql
-- ============================================================================

-- 0. Completion date fix (also used by the Penghantaran Extra and normal delivery paths)
create or replace function recompute_order(p_order_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_all_full boolean;
  v_completed date;
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

  -- The order was completed on the day its LAST ordered line reached the ordered quantity.
  -- Extra cartons delivered afterwards (buffer, Dihantar Lebih) must not move that date.
  select max(line_done) into v_completed
  from (
    select (
      select min(x.d) from (
        select db.delivered_date d,
               sum(db.qty) over (order by db.delivered_date, db.batch_no rows unbounded preceding) cum
        from delivery_batches db where db.order_line_id = ol.id
      ) x
      where x.cum >= ol.cartons_ordered
    ) as line_done
    from order_lines ol
    where ol.order_id = p_order_id and ol.cartons_ordered > 0
  ) t;

  update orders
    set total = coalesce((select sum(line_value) from order_lines where order_id = p_order_id), 0),
        completed_date = case when v_all_full then v_completed else null end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function recompute_order(uuid) from public, anon, authenticated;

-- 1. The new role
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.user_profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%halal%'
  loop
    execute format('alter table public.user_profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('outlet', 'operator', 'admin', 'halal', 'delivery'));

create or replace function is_delivery()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role = 'delivery');
$$;
grant execute on function is_delivery() to authenticated;

-- Today in Malaysia (the database clock is UTC; an entry at 7 am must not be dated yesterday)
create or replace function kl_today()
returns date
language sql stable as $$
  select (now() at time zone 'Asia/Kuala_Lumpur')::date;
$$;
grant execute on function kl_today() to authenticated;

-- Monday of the current week in Malaysia (weeks run Monday to Sunday)
create or replace function kl_week_start()
returns date
language sql stable as $$
  select kl_today() - (extract(isodow from kl_today())::int - 1);
$$;
grant execute on function kl_week_start() to authenticated;

-- 2. Drops (one per outlet visit / photo) + batch columns
create table if not exists delivery_drops (
  id              uuid primary key default gen_random_uuid(),
  outlet_id       uuid not null references outlets(id),
  delivered_date  date not null,
  photo_path      text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
alter table delivery_drops enable row level security; -- no policies: reached only through the functions below

alter table delivery_batches add column if not exists drop_id uuid references delivery_drops(id);
alter table delivery_batches add column if not exists is_extra_part boolean not null default false;
create index if not exists idx_delivery_batches_drop on delivery_batches(drop_id);
create index if not exists idx_delivery_drops_date on delivery_drops(delivered_date);
create index if not exists idx_delivery_drops_outlet on delivery_drops(outlet_id, delivered_date);

-- 3. Internal: allocate ONE product entry. Returns where the cartons went + touched orders.
create or replace function _allocate_staff_entry(
  p_outlet_id uuid, p_product_id uuid, p_cartons integer, p_expiry date, p_date date, p_drop_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_left integer := p_cartons;
  v_owed integer;
  v_take integer;
  v_batch_no integer;
  v_ol order_lines%rowtype;
  v_latest orders;
  v_order_no text;
  v_kind text;
  v_knocked jsonb := '[]'::jsonb;
  v_extra jsonb := null;
  v_touched jsonb := '[]'::jsonb;
begin
  select * into v_product from products where id = p_product_id and active;
  if not found then raise exception 'Unknown or inactive product'; end if;

  select * into v_latest from orders
    where outlet_id = p_outlet_id and not cancelled and order_date <= p_date
    order by order_date desc, created_at desc
    limit 1;
  if not found then
    raise exception 'This outlet has no order on or before that date to attach the delivery to';
  end if;

  -- knock off what is still owed: OLDEST order first
  for v_ol in
    select ol.* from order_lines ol join orders o on o.id = ol.order_id
    where o.outlet_id = p_outlet_id and not o.cancelled and o.order_date <= p_date
      and ol.product_id = p_product_id
    order by o.order_date, o.created_at, ol.created_at
  loop
    exit when v_left <= 0;
    v_owed := v_ol.cartons_ordered
      - coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = v_ol.id), 0);
    continue when v_owed <= 0;
    v_take := least(v_left, v_owed);

    select greatest(2, coalesce(max(batch_no), 0)) + 1 into v_batch_no
      from delivery_batches where order_line_id = v_ol.id;
    insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by, drop_id)
    values (v_ol.id, v_batch_no, v_take, p_expiry, p_date, auth.uid(), p_drop_id);

    select order_no into v_order_no from orders where id = v_ol.order_id;
    v_knocked := v_knocked || jsonb_build_object('order_no', v_order_no, 'cartons', v_take, 'was_owed', v_owed);
    v_touched := v_touched || to_jsonb(v_ol.order_id::text);
    v_left := v_left - v_take;
  end loop;

  -- leftover: beyond everything owed -> extra on the latest order
  if v_left > 0 then
    select * into v_ol from order_lines
      where order_id = v_latest.id and product_id = p_product_id
      order by created_at limit 1;
    if found then
      v_kind := 'dihantar_lebih';
    else
      insert into order_lines (
        order_id, product_id, cartons_ordered,
        unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value, is_extra
      ) values (
        v_latest.id, p_product_id, 0,
        v_product.unit_price, v_product.units_per_carton,
        v_product.unit_price * v_product.units_per_carton, 0, true
      ) returning * into v_ol;
      v_kind := 'penghantaran_extra';
    end if;

    select greatest(2, coalesce(max(batch_no), 0)) + 1 into v_batch_no
      from delivery_batches where order_line_id = v_ol.id;
    insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, delivered_date, recorded_by, drop_id, is_extra_part)
    values (v_ol.id, v_batch_no, v_left, p_expiry, p_date, auth.uid(), p_drop_id, true);

    v_extra := jsonb_build_object('order_no', v_latest.order_no, 'cartons', v_left, 'kind', v_kind);
    v_touched := v_touched || to_jsonb(v_latest.id::text);
  end if;

  return jsonb_build_object(
    'product', v_product.name, 'cartons', p_cartons,
    'knocked_off', v_knocked, 'extra', v_extra, 'touched', v_touched);
end;
$$;
revoke execute on function _allocate_staff_entry(uuid, uuid, integer, date, date, uuid) from public, anon, authenticated;

-- 4. Save a delivery drop. p_lines: [{"product_id": uuid, "cartons": int, "expiry": "YYYY-MM-DD"}]
-- p_drop_id is generated by the app; the photo is uploaded to delivery-photos/<drop_id>.jpg first.
create or replace function record_staff_delivery(p_outlet_id uuid, p_lines jsonb, p_drop_id uuid, p_photo_path text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_date date := kl_today();
  v_line jsonb;
  v_cartons integer;
  v_expiry date;
  v_res jsonb;
  v_summary jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_pid uuid;
  v_oid text;
begin
  if not (is_delivery() or is_operator()) then
    raise exception 'Only delivery staff and operators can record deliveries';
  end if;
  if p_drop_id is null then raise exception 'Missing delivery id'; end if;
  if exists (select 1 from delivery_drops where id = p_drop_id) then
    raise exception 'This delivery was already saved';
  end if;
  if not exists (select 1 from outlets where id = p_outlet_id) then
    raise exception 'Outlet not found';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one product';
  end if;
  if jsonb_array_length(p_lines) > 60 then
    raise exception 'Too many products in one delivery';
  end if;
  if p_photo_path is distinct from (p_drop_id::text || '.jpg') then
    raise exception 'A photo of the delivery is required';
  end if;

  -- one delivery per outlet at a time, so two people cannot knock off the same owed cartons twice
  perform pg_advisory_xact_lock(hashtextextended('outlet-delivery:' || p_outlet_id::text, 0));

  insert into delivery_drops (id, outlet_id, delivered_date, photo_path, created_by)
  values (p_drop_id, p_outlet_id, v_date, p_photo_path, auth.uid());

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line->>'product_id')::uuid;
    if v_pid = any(v_seen) then
      raise exception 'Each product can only be listed once per delivery';
    end if;
    v_seen := v_seen || v_pid;

    v_cartons := (v_line->>'cartons')::integer;
    if v_cartons is null or v_cartons <= 0 then
      raise exception 'Cartons must be more than 0';
    end if;
    v_expiry := nullif(v_line->>'expiry', '')::date;
    if v_expiry is null then raise exception 'Enter the expiry date'; end if;
    if v_expiry < v_date then raise exception 'Expiry date is already past'; end if;

    v_res := _allocate_staff_entry(p_outlet_id, v_pid, v_cartons, v_expiry, v_date, p_drop_id);
    v_summary := v_summary || (v_res - 'touched');
    for v_oid in select jsonb_array_elements_text(v_res->'touched') loop
      perform recompute_order(v_oid::uuid);
    end loop;
  end loop;

  return jsonb_build_object('drop_id', p_drop_id, 'delivered_date', v_date, 'lines', v_summary);
end;
$$;
grant execute on function record_staff_delivery(uuid, jsonb, uuid, text) to authenticated;

-- 5. Correct one product entry of a drop (p_cartons = 0 removes it).
create or replace function correct_delivery_entry(p_drop_id uuid, p_product_id uuid, p_cartons integer, p_expiry date)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_drop delivery_drops%rowtype;
  v_orders uuid[];
  v_res jsonb := null;
  v_oid text;
  v_id uuid;
begin
  if not (is_delivery() or is_operator()) then
    raise exception 'Only delivery staff and operators can change deliveries';
  end if;
  select * into v_drop from delivery_drops where id = p_drop_id;
  if not found then raise exception 'Delivery not found'; end if;
  if not is_operator() and v_drop.delivered_date < kl_week_start() then
    raise exception 'This delivery is from an earlier week. Ask an operator to change it.';
  end if;
  if p_cartons is null or p_cartons < 0 then raise exception 'Cartons cannot be negative'; end if;
  perform pg_advisory_xact_lock(hashtextextended('outlet-delivery:' || v_drop.outlet_id::text, 0));

  select array_agg(distinct ol.order_id) into v_orders
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where db.drop_id = p_drop_id and ol.product_id = p_product_id;
  if v_orders is null then raise exception 'That product is not part of this delivery'; end if;

  delete from delivery_batches db
    using order_lines ol
    where ol.id = db.order_line_id and db.drop_id = p_drop_id and ol.product_id = p_product_id;
  -- an extra line left with nothing delivered is just clutter
  delete from order_lines ol
    where ol.order_id = any(v_orders) and ol.product_id = p_product_id and ol.is_extra
      and not exists (select 1 from delivery_batches db where db.order_line_id = ol.id);

  if p_cartons > 0 then
    if p_expiry is null then raise exception 'Enter the expiry date'; end if;
    if p_expiry < v_drop.delivered_date then raise exception 'Expiry date is already past'; end if;
    v_res := _allocate_staff_entry(v_drop.outlet_id, p_product_id, p_cartons, p_expiry, v_drop.delivered_date, p_drop_id);
    for v_oid in select jsonb_array_elements_text(v_res->'touched') loop
      if not (v_oid::uuid = any(v_orders)) then v_orders := v_orders || v_oid::uuid; end if;
    end loop;
  end if;

  foreach v_id in array v_orders loop
    perform recompute_order(v_id);
  end loop;

  return coalesce(v_res - 'touched', jsonb_build_object('removed', true));
end;
$$;
grant execute on function correct_delivery_entry(uuid, uuid, integer, date) to authenticated;

-- 6. The delivery log (screen + Excel/PDF). One row per batch; an entry that
-- knocked off several orders appears as several rows.
create or replace function list_deliveries(p_from date, p_to date, p_outlet_id uuid default null)
returns table (
  batch_id uuid, drop_id uuid, delivered_date date,
  outlet_code text, outlet_name text,
  product_id uuid, product_code text, product_name text,
  cartons integer, expiry_date date, order_no text,
  kind text, entered_by text, photo_path text, created_at timestamptz, can_correct boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_delivery() or is_operator()) then
    raise exception 'Only delivery staff and operators can view deliveries';
  end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose a valid date range'; end if;
  if p_to - p_from > 92 then raise exception 'Choose a range of 3 months or less'; end if;

  return query
  select db.id, d.id, d.delivered_date,
         o2.code, o2.name,
         pr.id, pr.code, pr.name,
         db.qty, db.expiry_date, od.order_no,
         case when db.is_extra_part then (case when ol.is_extra then 'penghantaran_extra' else 'dihantar_lebih' end)
              else 'normal' end,
         coalesce(up.full_name, 'Staff'), d.photo_path, db.recorded_at,
         (is_operator() or d.delivered_date >= kl_week_start())
  from delivery_batches db
  join delivery_drops d on d.id = db.drop_id
  join outlets o2 on o2.id = d.outlet_id
  join order_lines ol on ol.id = db.order_line_id
  join orders od on od.id = ol.order_id
  join products pr on pr.id = ol.product_id
  left join user_profiles up on up.id = d.created_by
  where d.delivered_date between p_from and p_to
    and (p_outlet_id is null or d.outlet_id = p_outlet_id)
  order by d.delivered_date desc, o2.code, pr.code, db.batch_no, db.id;
end;
$$;
grant execute on function list_deliveries(date, date, uuid) to authenticated;

-- 7. Private photo bucket: one compressed JPEG per drop, named <drop_id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-photos', 'delivery-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "delivery photos staff insert" on storage.objects;
create policy "delivery photos staff insert" on storage.objects for insert
  with check (
    bucket_id = 'delivery-photos' and (public.is_delivery() or public.is_operator())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );

drop policy if exists "delivery photos staff read" on storage.objects;
create policy "delivery photos staff read" on storage.objects for select
  using (bucket_id = 'delivery-photos' and (public.is_delivery() or public.is_operator()));

drop policy if exists "delivery photos operator delete" on storage.objects;
create policy "delivery photos operator delete" on storage.objects for delete
  using (bucket_id = 'delivery-photos' and public.is_operator());
