import { supabase } from '../supabaseClient'

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, code, name, category, unit_price, units_per_carton, carton_price, active')
    .eq('active', true)
    .order('code')
  if (error) throw error
  return data
}
