-- ============================================================================
-- CK Products Ordering Portal — Supabase schema (revision 2)
-- Companion to MIGRATION_BRIEF.md.
--
-- Revision 2 changes vs the original draft (see chat history / PR notes):
--   - All writes to orders/order_lines/delivery_batches/stock_reports/
--     stock_report_lines now happen ONLY through SECURITY DEFINER RPC
--     functions (place_order, edit_order, cancel_order, record_delivery,
--     submit_stock_report, ...). Tables carry SELECT-only RLS policies for
--     outlet/operator roles — there is no direct INSERT/UPDATE/DELETE policy
--     for any client role, so a modified frontend cannot bypass the 3-day
--     edit window, the delivery-lock rule, or the reorder flow by calling
--     the REST table endpoints directly. Business rules live in one place.
--   - is_operator()/my_outlet_id() are now SECURITY DEFINER with a fixed
--     search_path — avoids the self-referencing-RLS footgun on
--     user_profiles and is the standard safe pattern for this in Supabase.
--   - order_number_counters + next_order_no(): atomic, concurrency-safe
--     CK-YYMM-### numbering (insert ... on conflict do update is a single
--     row-locking statement, safe if two outlets order at the same instant).
--   - orders.is_reorder boolean added (instead of detecting "is this a
--     reorder" by checking if `note` is non-empty) — robust regardless of
--     UI language, used by the operator badge and the PDF's reorder flag.
--   - app_settings table + is_stock_window_open()/set_stock_window_override()
--     replace the prototype's public "preview" checkbox with a real
--     admin-only override (brief section 9.5).
--
-- Still a draft — review before applying to the real Supabase project.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- outlets
-- ---------------------------------------------------------------------------
create table outlets (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,        -- e.g. 'MBG001'
  name          text not null,                -- e.g. 'MBG Putra Heights'
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table products (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,     -- e.g. 'P01'
  name               text not null,
  category           smallint not null check (category in (1, 2)), -- 1=Dry & Nuts, 2=Funfruits
  unit_price         numeric(10,2) not null,
  units_per_carton   integer not null check (units_per_carton > 0),
  active             boolean not null default true,
  photo_url          text,
  created_at         timestamptz not null default now()
);

-- carton price is derived, kept as a generated column for convenience
alter table products
  add column carton_price numeric(10,2)
  generated always as (unit_price * units_per_carton) stored;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_no         text unique not null,       -- 'CK-YYMM-###'
  outlet_id        uuid not null references outlets(id),
  order_date       date not null default current_date,
  cancelled        boolean not null default false,
  is_reorder       boolean not null default false,
  note             text,                       -- freeform, e.g. reorder reason
  completed_date   date,                       -- set when fully delivered
  total            numeric(12,2) not null default 0,  -- denormalized sum of line values, maintained by RPCs
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id)
);

create index idx_orders_outlet on orders(outlet_id);
create index idx_orders_date on orders(order_date);

-- 30-day rolling due date, derived per order (not stored — compute in queries/app):
--   due_date = order_date + interval '30 days'

-- ---------------------------------------------------------------------------
-- order_lines
-- price fields are SNAPSHOTS at time of ordering — never join back to
-- products.unit_price for historical value, always read these columns.
-- Written only by place_order()/edit_order() below.
-- ---------------------------------------------------------------------------
create table order_lines (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id) on delete cascade,
  product_id                uuid not null references products(id),
  cartons_ordered           integer not null check (cartons_ordered > 0),
  unit_price_snapshot       numeric(10,2) not null,
  units_per_carton_snapshot integer not null,
  carton_price_snapshot     numeric(10,2) not null,
  line_value                numeric(12,2) not null, -- cartons_ordered * carton_price_snapshot
  created_at                timestamptz not null default now()
);

create index idx_order_lines_order on order_lines(order_id);
create index idx_order_lines_product on order_lines(product_id);

-- ---------------------------------------------------------------------------
-- delivery_batches
-- Up to 2 batches per order line in the current UI, but modeled as a
-- one-to-many table so a 3rd batch is a config change, not a schema change.
-- Written only by record_delivery() below.
-- ---------------------------------------------------------------------------
create table delivery_batches (
  id             uuid primary key default gen_random_uuid(),
  order_line_id  uuid not null references order_lines(id) on delete cascade,
  batch_no       smallint not null check (batch_no in (1, 2)),
  qty            integer not null check (qty > 0),
  expiry_date    date,
  recorded_at    timestamptz not null default now(),
  recorded_by    uuid references auth.users(id),
  unique (order_line_id, batch_no)
);

create index idx_delivery_batches_line on delivery_batches(order_line_id);

-- Convenience view: delivered qty per order line
create view order_line_delivered as
  select order_line_id, coalesce(sum(qty), 0) as delivered_qty
  from delivery_batches
  group by order_line_id;

-- ---------------------------------------------------------------------------
-- stock_reports  (one per outlet per month)
-- Written only by submit_stock_report() below.
-- ---------------------------------------------------------------------------
create table stock_reports (
  id             uuid primary key default gen_random_uuid(),
  outlet_id      uuid not null references outlets(id),
  report_month   char(7) not null,             -- 'YYYY-MM'
  submitted_at   timestamptz not null default now(),
  submitted_by   uuid references auth.users(id),
  unique (outlet_id, report_month)              -- resubmission replaces, doesn't duplicate
);

create index idx_stock_reports_month on stock_reports(report_month);

-- ---------------------------------------------------------------------------
-- stock_report_lines
-- Single nearest-expiry date per product per report (FIFO encouragement).
-- ---------------------------------------------------------------------------
create table stock_report_lines (
  id                uuid primary key default gen_random_uuid(),
  stock_report_id   uuid not null references stock_reports(id) on delete cascade,
  product_id        uuid not null references products(id),
  qty_on_hand       integer not null check (qty_on_hand >= 0),  -- single units
  nearest_expiry    date,
  unique (stock_report_id, product_id)
);

-- ---------------------------------------------------------------------------
-- user_profiles
-- Links a Supabase Auth user to either an outlet (outlet role) or marks them
-- as operator/admin. Keep auth.users itself untouched; extend via this table.
-- Rows are created by the outlet-provisioning seed script (using the
-- service-role key, which bypasses RLS) — there is no client-facing INSERT
-- policy for v1.
-- ---------------------------------------------------------------------------
create table user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('outlet', 'operator', 'admin')),
  outlet_id    uuid references outlets(id),   -- required when role = 'outlet'
  full_name    text,
  created_at   timestamptz not null default now(),
  constraint outlet_role_requires_outlet
    check (role <> 'outlet' or outlet_id is not null)
);

-- ---------------------------------------------------------------------------
-- order_number_counters
-- Backs next_order_no() below — one row per 'YYMM', atomically incremented.
-- ---------------------------------------------------------------------------
create table order_number_counters (
  month_key   char(4) primary key,   -- 'YYMM'
  next_seq    integer not null default 1
);

-- ---------------------------------------------------------------------------
-- app_settings
-- Small key/value table for admin-only settings. First use: the stock
-- reporting window override (brief section 9.5) — replaces the prototype's
-- public "preview" checkbox. Read via is_stock_window_open(), written via
-- set_stock_window_override(); the table itself is never exposed directly.
-- ---------------------------------------------------------------------------
create table app_settings (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table outlets enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table delivery_batches enable row level security;
alter table stock_reports enable row level security;
alter table stock_report_lines enable row level security;
alter table user_profiles enable row level security;
alter table order_number_counters enable row level security; -- no policies: no client access at all
alter table app_settings enable row level security;          -- no policies: no client access at all

-- Helper: is the current user an operator/admin?
-- SECURITY DEFINER so this doesn't re-trigger RLS on user_profiles when
-- evaluated from within a user_profiles policy.
create or replace function is_operator()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role in ('operator', 'admin')
  );
$$;

-- Helper: current user's own outlet_id, if any
create or replace function my_outlet_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select outlet_id from user_profiles where id = auth.uid();
$$;

grant execute on function is_operator() to authenticated;
grant execute on function my_outlet_id() to authenticated;

-- Products & outlets: readable by any authenticated user, no client writes in v1
create policy "read products" on products for select using (auth.role() = 'authenticated');
create policy "read outlets" on outlets for select using (auth.role() = 'authenticated');

-- Orders: SELECT only. All writes go through the RPC functions below.
create policy "read own orders" on orders for select
  using (is_operator() or outlet_id = my_outlet_id());

create policy "order_lines follow parent order" on order_lines for select
  using (exists (select 1 from orders o where o.id = order_id
                 and (is_operator() or o.outlet_id = my_outlet_id())));

create policy "delivery_batches follow parent order" on delivery_batches for select
  using (is_operator() or exists (
    select 1 from order_lines ol join orders o on o.id = ol.order_id
    where ol.id = order_line_id and o.outlet_id = my_outlet_id()
  ));

create policy "stock_reports own outlet" on stock_reports for select
  using (is_operator() or outlet_id = my_outlet_id());

create policy "stock_report_lines follow parent" on stock_report_lines for select
  using (exists (select 1 from stock_reports sr where sr.id = stock_report_id
                 and (is_operator() or sr.outlet_id = my_outlet_id())));

create policy "user reads own profile" on user_profiles for select
  using (id = auth.uid() or is_operator());

-- ============================================================================
-- RPC functions — the only way client roles mutate orders/deliveries/stock.
-- All are SECURITY DEFINER (bypass RLS internally, since they do their own
-- authorization + business-rule checks against auth.uid()).
-- ============================================================================

-- Atomically reserve the next CK-YYMM-### number for a given order date.
create or replace function next_order_no(p_order_date date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_month_key char(4) := to_char(p_order_date, 'YYMM');
  v_seq integer;
begin
  insert into order_number_counters (month_key, next_seq)
  values (v_month_key, 2)
  on conflict (month_key) do update set next_seq = order_number_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return 'CK-' || v_month_key || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Place a new order (or a reorder) for the caller's own outlet.
-- p_lines: jsonb array of {"product_id": uuid, "cartons": integer}
create or replace function place_order(p_lines jsonb, p_is_reorder boolean default false)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_outlet_id uuid := my_outlet_id();
  v_order orders;
  v_order_no text;
  v_line jsonb;
  v_product products%rowtype;
  v_cartons integer;
  v_carton_price numeric(10,2);
  v_line_value numeric(12,2);
  v_total numeric(12,2) := 0;
begin
  if v_outlet_id is null then
    raise exception 'Only an outlet user can place an order';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Order must have at least one line';
  end if;

  v_order_no := next_order_no(current_date);

  insert into orders (order_no, outlet_id, order_date, is_reorder, note, created_by)
  values (
    v_order_no, v_outlet_id, current_date, p_is_reorder,
    case when p_is_reorder then 'Re-order — items not yet received' else null end,
    auth.uid()
  )
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_cartons := (v_line->>'cartons')::integer;
    if v_cartons is null or v_cartons <= 0 then
      raise exception 'Invalid cartons for line %', v_line;
    end if;

    select * into v_product from products
      where id = (v_line->>'product_id')::uuid and active;
    if not found then
      raise exception 'Unknown or inactive product %', v_line->>'product_id';
    end if;

    v_carton_price := v_product.unit_price * v_product.units_per_carton;
    v_line_value := v_carton_price * v_cartons;
    v_total := v_total + v_line_value;

    insert into order_lines (
      order_id, product_id, cartons_ordered,
      unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value
    ) values (
      v_order.id, v_product.id, v_cartons,
      v_product.unit_price, v_product.units_per_carton, v_carton_price, v_line_value
    );
  end loop;

  update orders set total = v_total where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

-- Edit a pending order's lines. Only allowed within the 3-day window and
-- only while nothing has been delivered against it yet (brief section 6.3).
create or replace function edit_order(p_order_id uuid, p_lines jsonb)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_outlet_id uuid := my_outlet_id();
  v_order orders;
  v_line jsonb;
  v_product products%rowtype;
  v_cartons integer;
  v_carton_price numeric(10,2);
  v_line_value numeric(12,2);
  v_total numeric(12,2) := 0;
  v_delivered integer;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_outlet_id is null or v_order.outlet_id <> v_outlet_id then
    raise exception 'Not your order';
  end if;
  if v_order.cancelled then raise exception 'Order is cancelled'; end if;
  if current_date - v_order.order_date > 3 then
    raise exception 'Edit window (3 days) has passed';
  end if;

  select coalesce(sum(db.qty), 0) into v_delivered
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;
  if v_delivered > 0 then
    raise exception 'Order already has deliveries recorded and can no longer be edited';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Order must have at least one line';
  end if;

  delete from order_lines where order_id = p_order_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_cartons := (v_line->>'cartons')::integer;
    if v_cartons is null or v_cartons <= 0 then
      raise exception 'Invalid cartons for line %', v_line;
    end if;

    select * into v_product from products
      where id = (v_line->>'product_id')::uuid and active;
    if not found then
      raise exception 'Unknown or inactive product %', v_line->>'product_id';
    end if;

    v_carton_price := v_product.unit_price * v_product.units_per_carton;
    v_line_value := v_carton_price * v_cartons;
    v_total := v_total + v_line_value;

    insert into order_lines (
      order_id, product_id, cartons_ordered,
      unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value
    ) values (
      p_order_id, v_product.id, v_cartons,
      v_product.unit_price, v_product.units_per_carton, v_carton_price, v_line_value
    );
  end loop;

  update orders set total = v_total where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- Cancel a pending order. Same 3-day / no-deliveries gating as edit_order().
create or replace function cancel_order(p_order_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_outlet_id uuid := my_outlet_id();
  v_order orders;
  v_delivered integer;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_outlet_id is null or v_order.outlet_id <> v_outlet_id then
    raise exception 'Not your order';
  end if;
  if v_order.cancelled then raise exception 'Order already cancelled'; end if;
  if current_date - v_order.order_date > 3 then
    raise exception 'Edit window (3 days) has passed';
  end if;

  select coalesce(sum(db.qty), 0) into v_delivered
    from delivery_batches db join order_lines ol on ol.id = db.order_line_id
    where ol.order_id = p_order_id;
  if v_delivered > 0 then
    raise exception 'Order already has deliveries recorded and can no longer be cancelled';
  end if;

  update orders set cancelled = true where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- Operator: record delivery batches for an order's lines and recompute
-- completed_date. p_lines: jsonb array of
-- {"order_line_id": uuid, "batch1_qty": int, "batch1_expiry": date|null,
--  "batch2_qty": int, "batch2_expiry": date|null}
create or replace function record_delivery(p_order_id uuid, p_lines jsonb)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_line jsonb;
  v_ol order_lines%rowtype;
  v_q1 integer; v_q2 integer;
  v_e1 date; v_e2 date;
  v_ordered_total integer;
  v_delivered_total integer;
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

    if v_q1 > 0 then
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, recorded_by)
      values (v_ol.id, 1, v_q1, v_e1, auth.uid())
      on conflict (order_line_id, batch_no) do update
        set qty = excluded.qty, expiry_date = excluded.expiry_date,
            recorded_at = now(), recorded_by = excluded.recorded_by;
    else
      delete from delivery_batches where order_line_id = v_ol.id and batch_no = 1;
    end if;

    if v_q2 > 0 then
      insert into delivery_batches (order_line_id, batch_no, qty, expiry_date, recorded_by)
      values (v_ol.id, 2, v_q2, v_e2, auth.uid())
      on conflict (order_line_id, batch_no) do update
        set qty = excluded.qty, expiry_date = excluded.expiry_date,
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

  update orders
    set completed_date = case when v_delivered_total >= v_ordered_total
                               then coalesce(completed_date, current_date)
                               else null end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

-- Is the monthly stock report window open right now? Public to any
-- authenticated user so the frontend can render the banner state.
create or replace function is_stock_window_open()
returns boolean
language sql stable security definer set search_path = public as $$
  select (extract(day from current_date) = 20)
    or coalesce(
         (select (value->>'enabled')::boolean from app_settings where key = 'stock_window_override'),
         false
       );
$$;

-- Operator-only: toggle the admin override for the stock reporting window.
create or replace function set_stock_window_override(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  insert into app_settings (key, value, updated_by)
  values ('stock_window_override', jsonb_build_object('enabled', p_enabled), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

-- Outlet: submit (or replace) this month's stock report.
-- p_lines: jsonb array of
-- {"product_id": uuid, "qty_on_hand": integer, "nearest_expiry": date|null}
create or replace function submit_stock_report(p_lines jsonb)
returns stock_reports
language plpgsql security definer set search_path = public as $$
declare
  v_outlet_id uuid := my_outlet_id();
  v_month char(7) := to_char(current_date, 'YYYY-MM');
  v_report stock_reports;
  v_line jsonb;
begin
  if v_outlet_id is null then
    raise exception 'Only an outlet user can submit a stock report';
  end if;
  if not is_stock_window_open() then
    raise exception 'Stock reporting window is closed';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Stock report must have at least one line';
  end if;

  insert into stock_reports (outlet_id, report_month, submitted_by)
  values (v_outlet_id, v_month, auth.uid())
  on conflict (outlet_id, report_month) do update
    set submitted_at = now(), submitted_by = excluded.submitted_by
  returning * into v_report;

  delete from stock_report_lines where stock_report_id = v_report.id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into stock_report_lines (stock_report_id, product_id, qty_on_hand, nearest_expiry)
    values (
      v_report.id,
      (v_line->>'product_id')::uuid,
      (v_line->>'qty_on_hand')::integer,
      nullif(v_line->>'nearest_expiry', '')::date
    );
  end loop;

  return v_report;
end;
$$;

grant execute on function place_order(jsonb, boolean) to authenticated;
grant execute on function edit_order(uuid, jsonb) to authenticated;
grant execute on function cancel_order(uuid) to authenticated;
grant execute on function record_delivery(uuid, jsonb) to authenticated;
grant execute on function is_stock_window_open() to authenticated;
grant execute on function set_stock_window_override(boolean) to authenticated;
grant execute on function submit_stock_report(jsonb) to authenticated;
