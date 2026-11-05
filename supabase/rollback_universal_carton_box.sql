-- ROLLBACK for universal_carton_box_setup.sql.
-- Recreates the four separate boxes, points the Almond / Cashew / Pistachio / Mix recipes
-- back at their own box (1 per carton), removes Kuah Rojak 490g's box-only recipe and the
-- universal box. Costs entered on the universal box are lost; the old boxes come back
-- with no cost and no stock (they had none).
-- If P03 (Kuah Rojak 490g) has since been given more ingredients, its recipe is kept and
-- only its box line is removed.
-- Single transaction. Paste into the Supabase SQL Editor and run once. Safe to re-run.

begin;

insert into raw_materials (code, name, unit, pack_size) values
  ('RM-BOX-ALM', 'Almond Outer Box', 'pcs', 1),
  ('RM-BOX-CSH', 'Cashew Outer Box', 'pcs', 1),
  ('RM-BOX-MIX', 'Mix Outer Box', 'pcs', 1),
  ('RM-BOX-PIS', 'Pistachio Outer Box', 'pcs', 1)
on conflict (code) do nothing;

-- Kuah Rojak: drop the box line (and the recipe itself if the box was all it had)
delete from product_recipe_lines
  where product_id = (select id from products where code = 'P03')
    and raw_material_id = (select id from raw_materials where code = 'RM-BOX-UNI');
delete from product_recipes
  where product_id = (select id from products where code = 'P03')
    and not exists (select 1 from product_recipe_lines where product_id = product_recipes.product_id);

-- Nuttybites: universal box -> each product's own box
update product_recipe_lines l
  set raw_material_id = (select id from raw_materials where code = v.box),
      qty = 1,
      basis = 'carton'
  from (values ('P05', 'RM-BOX-ALM'), ('P06', 'RM-BOX-CSH'), ('P07', 'RM-BOX-MIX'), ('P08', 'RM-BOX-PIS')) as v(pcode, box)
  where l.product_id = (select id from products where code = v.pcode)
    and l.raw_material_id = (select id from raw_materials where code = 'RM-BOX-UNI');

delete from raw_materials where code = 'RM-BOX-UNI';

commit;
