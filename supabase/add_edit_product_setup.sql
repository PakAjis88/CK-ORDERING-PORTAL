-- ============================================================================
-- Let the operator add and edit products in the Catalogue
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- p_id is null -> create a new product (code must be unique, provided by the
-- operator). p_id set -> edit an existing product; p_code is accepted but
-- ignored on this path — the code is immutable once created (it's also the
-- product photo's storage path key, and the identifier used in CSV/PDF
-- exports), so it's enforced here server-side, not just in the UI.
-- ============================================================================

create or replace function upsert_product(
  p_id uuid, p_code text, p_name text, p_category smallint,
  p_unit_price numeric, p_units_per_carton integer
)
returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_display_order smallint;
  v_old_category smallint;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Product name is required';
  end if;
  if p_category not in (1, 2) then
    raise exception 'Invalid category';
  end if;
  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Unit price must be greater than 0';
  end if;
  if p_units_per_carton is null or p_units_per_carton <= 0 then
    raise exception 'Units per carton must be greater than 0';
  end if;

  if p_id is null then
    if p_code is null or trim(p_code) = '' then
      raise exception 'Product code is required';
    end if;
    if exists (select 1 from products where code = p_code) then
      raise exception 'Product code % is already in use', p_code;
    end if;

    select coalesce(max(display_order), 0) + 1 into v_display_order
      from products where category = p_category;

    insert into products (code, name, category, unit_price, units_per_carton, display_order)
    values (p_code, p_name, p_category, p_unit_price, p_units_per_carton, v_display_order)
    returning * into v_product;
  else
    select category into v_old_category from products where id = p_id;
    if not found then
      raise exception 'Product not found';
    end if;

    if p_category <> v_old_category then
      select coalesce(max(display_order), 0) + 1 into v_display_order
        from products where category = p_category;
      update products
        set name = p_name, category = p_category, display_order = v_display_order,
            unit_price = p_unit_price, units_per_carton = p_units_per_carton
        where id = p_id
        returning * into v_product;
    else
      update products
        set name = p_name, category = p_category,
            unit_price = p_unit_price, units_per_carton = p_units_per_carton
        where id = p_id
        returning * into v_product;
    end if;
  end if;

  return v_product;
end;
$$;

grant execute on function upsert_product(uuid, text, text, smallint, numeric, integer) to authenticated;
