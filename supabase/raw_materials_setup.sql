-- ============================================================================
-- Raw Material Planning — schema, RPCs, and seed data for the Nuttybites series
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Lets the operator see how much raw material (ingredients + packaging) is
-- needed to fulfil outstanding outlet orders. Each product's recipe is a
-- batch_yield plus a list of lines, each measured on one of three bases:
--   'batch'  — qty per whole production batch (not used by Nuttybites yet)
--   'unit'   — qty per single finished pack (e.g. 1 pouch)
--   'carton' — qty per carton of finished product (e.g. 10kg nuts, 1 box)
-- The calculation itself lives client-side in src/lib/materialPlan.js, same
-- pattern as productionSummary() — this migration is schema + RPCs only.
--
-- pack_size (purchase pack size, e.g. "nuts bought per 25kg sack") defaults
-- to 1 below since real supplier pack sizes weren't available yet — the
-- operator can correct these later via the Raw Materials screen. Until then,
-- "suggested buy" is just the exact shortfall, not rounded to any pack.
-- ============================================================================

create table if not exists raw_materials (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  unit           text not null check (unit in ('kg', 'g', 'L', 'ml', 'pcs')),
  pack_size      numeric(10,3) not null default 1 check (pack_size > 0),
  stock_on_hand  numeric(12,3) not null default 0 check (stock_on_hand >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists product_recipes (
  product_id   uuid primary key references products(id),
  batch_yield  integer not null check (batch_yield > 0)
);

create table if not exists product_recipe_lines (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id),
  raw_material_id  uuid not null references raw_materials(id),
  qty              numeric(12,4) not null check (qty > 0),
  basis            text not null check (basis in ('batch', 'unit', 'carton')),
  unique (product_id, raw_material_id)
);

alter table raw_materials enable row level security;
alter table product_recipes enable row level security;
alter table product_recipe_lines enable row level security;

drop policy if exists "raw_materials operator read" on raw_materials;
create policy "raw_materials operator read" on raw_materials for select using (is_operator());

drop policy if exists "product_recipes operator read" on product_recipes;
create policy "product_recipes operator read" on product_recipes for select using (is_operator());

drop policy if exists "product_recipe_lines operator read" on product_recipe_lines;
create policy "product_recipe_lines operator read" on product_recipe_lines for select using (is_operator());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function upsert_raw_material(p_id uuid, p_code text, p_name text, p_unit text, p_pack_size numeric)
returns raw_materials
language plpgsql security definer set search_path = public as $$
declare
  v_row raw_materials;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Raw material name is required';
  end if;
  if p_unit not in ('kg', 'g', 'L', 'ml', 'pcs') then
    raise exception 'Invalid unit';
  end if;
  if p_pack_size is null or p_pack_size <= 0 then
    raise exception 'Pack size must be greater than 0';
  end if;

  if p_id is null then
    if p_code is null or trim(p_code) = '' then
      raise exception 'Raw material code is required';
    end if;
    if exists (select 1 from raw_materials where code = p_code) then
      raise exception 'Raw material code % is already in use', p_code;
    end if;
    insert into raw_materials (code, name, unit, pack_size)
    values (p_code, p_name, p_unit, p_pack_size)
    returning * into v_row;
  else
    update raw_materials
      set name = p_name, unit = p_unit, pack_size = p_pack_size
      where id = p_id
      returning * into v_row;
    if not found then
      raise exception 'Raw material not found';
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function set_raw_material_stock(p_id uuid, p_qty numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_qty is null or p_qty < 0 then
    raise exception 'Stock quantity must be 0 or greater';
  end if;
  update raw_materials set stock_on_hand = p_qty where id = p_id;
end;
$$;

-- Replaces a product's whole recipe in one call (batch_yield + every line).
create or replace function save_product_recipe(p_product_id uuid, p_batch_yield integer, p_lines jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_batch_yield is null or p_batch_yield <= 0 then
    raise exception 'Batch yield must be greater than 0';
  end if;

  insert into product_recipes (product_id, batch_yield)
  values (p_product_id, p_batch_yield)
  on conflict (product_id) do update set batch_yield = excluded.batch_yield;

  delete from product_recipe_lines where product_id = p_product_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
    values (
      p_product_id,
      (v_line->>'raw_material_id')::uuid,
      (v_line->>'qty')::numeric,
      v_line->>'basis'
    );
  end loop;
end;
$$;

grant execute on function upsert_raw_material(uuid, text, text, text, numeric) to authenticated;
grant execute on function set_raw_material_stock(uuid, numeric) to authenticated;
grant execute on function save_product_recipe(uuid, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed data: the 4 Nuttybites recipes (confirmed with the user 2026-10-01)
-- ---------------------------------------------------------------------------

insert into raw_materials (code, name, unit) values
  ('RM-NUT-ALM', 'Roasted Almond', 'kg'),
  ('RM-NUT-CSH', 'Roasted Cashew', 'kg'),
  ('RM-NUT-PIS', 'Roasted Pistachio', 'kg'),
  ('RM-NUT-MIX', 'Roasted Mixed Nut', 'kg'),
  ('RM-PCH-ALM', 'Almond Pouch 30g', 'pcs'),
  ('RM-PCH-CSH', 'Cashew Pouch 30g', 'pcs'),
  ('RM-PCH-PIS', 'Pistachio Pouch 30g', 'pcs'),
  ('RM-PCH-MIX', 'Mix Pouch 40g', 'pcs'),
  ('RM-BOX-ALM', 'Almond Outer Box', 'pcs'),
  ('RM-BOX-CSH', 'Cashew Outer Box', 'pcs'),
  ('RM-BOX-PIS', 'Pistachio Outer Box', 'pcs'),
  ('RM-BOX-MIX', 'Mix Outer Box', 'pcs')
on conflict (code) do nothing;

-- P05 Almond 30G — batch yield 330 packs
insert into product_recipes (product_id, batch_yield)
  select id, 330 from products where code = 'P05'
  on conflict (product_id) do update set batch_yield = excluded.batch_yield;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 10, 'carton' from products p, raw_materials r where p.code = 'P05' and r.code = 'RM-NUT-ALM'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'unit' from products p, raw_materials r where p.code = 'P05' and r.code = 'RM-PCH-ALM'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'carton' from products p, raw_materials r where p.code = 'P05' and r.code = 'RM-BOX-ALM'
  on conflict (product_id, raw_material_id) do nothing;

-- P06 Cashew 30G — batch yield 330 packs
insert into product_recipes (product_id, batch_yield)
  select id, 330 from products where code = 'P06'
  on conflict (product_id) do update set batch_yield = excluded.batch_yield;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 10, 'carton' from products p, raw_materials r where p.code = 'P06' and r.code = 'RM-NUT-CSH'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'unit' from products p, raw_materials r where p.code = 'P06' and r.code = 'RM-PCH-CSH'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'carton' from products p, raw_materials r where p.code = 'P06' and r.code = 'RM-BOX-CSH'
  on conflict (product_id, raw_material_id) do nothing;

-- P07 Mix 40G — batch yield 245 packs
insert into product_recipes (product_id, batch_yield)
  select id, 245 from products where code = 'P07'
  on conflict (product_id) do update set batch_yield = excluded.batch_yield;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 10, 'carton' from products p, raw_materials r where p.code = 'P07' and r.code = 'RM-NUT-MIX'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'unit' from products p, raw_materials r where p.code = 'P07' and r.code = 'RM-PCH-MIX'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'carton' from products p, raw_materials r where p.code = 'P07' and r.code = 'RM-BOX-MIX'
  on conflict (product_id, raw_material_id) do nothing;

-- P08 Pistachio 30G — batch yield 330 packs
insert into product_recipes (product_id, batch_yield)
  select id, 330 from products where code = 'P08'
  on conflict (product_id) do update set batch_yield = excluded.batch_yield;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 10, 'carton' from products p, raw_materials r where p.code = 'P08' and r.code = 'RM-NUT-PIS'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'unit' from products p, raw_materials r where p.code = 'P08' and r.code = 'RM-PCH-PIS'
  on conflict (product_id, raw_material_id) do nothing;
insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, r.id, 1, 'carton' from products p, raw_materials r where p.code = 'P08' and r.code = 'RM-BOX-PIS'
  on conflict (product_id, raw_material_id) do nothing;
