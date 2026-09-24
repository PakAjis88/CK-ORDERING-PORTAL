import { supabase } from '../supabaseClient'

// Operator-only: add (id omitted) or edit (id set) a product.
export async function upsertProduct({ id, code, name, category, unitPrice, unitsPerCarton }) {
  const { data, error } = await supabase.rpc('upsert_product', {
    p_id: id || null,
    p_code: code,
    p_name: name,
    p_category: category,
    p_unit_price: unitPrice,
    p_units_per_carton: unitsPerCarton,
  })
  if (error) throw error
  return data
}

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, code, name, category, unit_price, units_per_carton, carton_price, active, photo_url')
    .eq('active', true)
    .order('display_order')
    .order('code')
  if (error) throw error
  return data
}
