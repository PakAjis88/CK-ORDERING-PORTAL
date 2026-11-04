-- ROLLBACK for raw_material_costing_setup.sql.
-- Removes the cost-per-unit column, the product-line column and their two functions.
-- WARNING: every raw material cost and every product line typed in since the setup is
-- lost (it lives only in those two columns). Nothing else is touched.
-- Run this only if the cost/product-line feature must be undone. If the site code that
-- uses these columns has already been pushed, roll the site back first (Netlify >
-- Deploys > previous deploy > Publish deploy), otherwise the Catalogue and Raw
-- Materials screens will error. Paste into the Supabase SQL Editor and run once.
-- Safe to re-run.

begin;

drop function if exists set_raw_material_cost(uuid, numeric);
drop function if exists set_product_line(uuid, text);

alter table raw_materials drop constraint if exists raw_materials_unit_cost_check;
alter table raw_materials drop column if exists unit_cost;
alter table products drop column if exists product_line;

commit;
