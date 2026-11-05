-- Universal carton box: ONE box (RM 1.64 per pcs) shared by the Nuttybites cartons
-- (30 packs) and Kuah Rojak 490g (12 bottles). One carton sold = one box, so every
-- recipe line is "1 per carton".
--  * creates RM-BOX-UNI "Carton Box (universal)" at RM 1.64 per pcs
--  * the recipes of P05 Almond, P06 Cashew, P07 Mix, P08 Pistachio switch from their
--    own box to the universal one (qty 1, per carton)
--  * P03 Kuah Rojak 490g gets a recipe with the box only (add its other ingredients later)
--  * the four old boxes (RM-BOX-ALM / CSH / MIX / PIS) are deleted
-- All in one transaction: it fully applies or not at all. Aborts if an old box still
-- has stock on hand. Paste into the Supabase SQL Editor and run once.
-- Undo: supabase/rollback_universal_carton_box.sql

begin;

do $$
begin
  if exists (
    select 1 from raw_materials
    where code in ('RM-BOX-ALM', 'RM-BOX-CSH', 'RM-BOX-MIX', 'RM-BOX-PIS') and stock_on_hand > 0
  ) then
    raise exception 'An old carton box still has stock on hand; move that stock first.';
  end if;
end $$;

insert into raw_materials (code, name, unit, pack_size, unit_cost)
values ('RM-BOX-UNI', 'Carton Box (universal)', 'pcs', 1, 1.64)
on conflict (code) do nothing;

-- the four Nuttybites recipes: own box -> universal box, 1 per carton
update product_recipe_lines
  set raw_material_id = (select id from raw_materials where code = 'RM-BOX-UNI'),
      qty = 1,
      basis = 'carton'
  where raw_material_id in (
    select id from raw_materials where code in ('RM-BOX-ALM', 'RM-BOX-CSH', 'RM-BOX-MIX', 'RM-BOX-PIS')
  );

-- Kuah Rojak 490g: recipe with the box only (batch_yield is required but unused by per-carton lines)
insert into product_recipes (product_id, batch_yield)
  select id, 1 from products where code = 'P03'
  on conflict (product_id) do nothing;

insert into product_recipe_lines (product_id, raw_material_id, qty, basis)
  select p.id, rm.id, 1, 'carton'
  from products p, raw_materials rm
  where p.code = 'P03' and rm.code = 'RM-BOX-UNI'
  on conflict (product_id, raw_material_id) do nothing;

-- the old boxes are no longer used; a stray reference would abort the whole transaction
delete from raw_materials where code in ('RM-BOX-ALM', 'RM-BOX-CSH', 'RM-BOX-MIX', 'RM-BOX-PIS');

commit;
