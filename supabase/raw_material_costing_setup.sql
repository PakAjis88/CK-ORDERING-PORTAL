-- Raw material costing + product lines.
--  * raw_materials.unit_cost: RM per ONE unit of use (e.g. Sugar RM 2.98 per kg).
--    Null = not entered yet. Cost per purchase pack = unit_cost x pack_size (derived).
--  * products.product_line: free-text finished-product line (e.g. Nuttybites),
--    used to filter raw materials by the type of finished product.
-- Additive only: no existing data changes except filling empty product lines.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

alter table raw_materials add column if not exists unit_cost numeric(12,4);
alter table raw_materials drop constraint if exists raw_materials_unit_cost_check;
alter table raw_materials add constraint raw_materials_unit_cost_check
  check (unit_cost is null or unit_cost >= 0);

alter table products add column if not exists product_line text;

-- Operator: set (or clear with null) a raw material's cost per unit of use.
create or replace function set_raw_material_cost(p_id uuid, p_cost numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_cost is not null and p_cost < 0 then
    raise exception 'Cost cannot be negative';
  end if;
  update raw_materials set unit_cost = p_cost where id = p_id;
  if not found then
    raise exception 'Raw material not found';
  end if;
end;
$$;

-- Operator: set (or clear with empty text) a product's line.
create or replace function set_product_line(p_id uuid, p_line text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  update products set product_line = nullif(trim(p_line), '') where id = p_id;
  if not found then
    raise exception 'Product not found';
  end if;
end;
$$;

grant execute on function set_raw_material_cost(uuid, numeric) to authenticated;
grant execute on function set_product_line(uuid, text) to authenticated;

-- Starting product lines for the current catalogue (only where still empty;
-- edit freely afterwards in the product Edit form).
update products p
  set product_line = v.line
  from (values
    ('P05', 'Nuttybites'), ('P06', 'Nuttybites'), ('P07', 'Nuttybites'), ('P08', 'Nuttybites'),
    ('P09', 'Serbuk Asam Boi'), ('P10', 'Serbuk Asam Boi'), ('P11', 'Serbuk Asam Boi'),
    ('P01', 'Asam Boi & Sweet Spicy'), ('P02', 'Asam Boi & Sweet Spicy'),
    ('P03', 'Kuah Rojak'), ('P04', 'Kuah Rojak'),
    ('P12', 'Sos Asam Boi'), ('P13', 'Sos Asam Boi')
  ) as v(code, line)
  where p.code = v.code and p.product_line is null;
