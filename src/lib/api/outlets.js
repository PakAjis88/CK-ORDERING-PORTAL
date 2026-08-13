import { supabase } from '../supabaseClient'

export async function listOutlets() {
  const { data, error } = await supabase
    .from('outlets')
    .select('id, code, name, active')
    .eq('active', true)
    .order('code')
  if (error) throw error
  return data
}
