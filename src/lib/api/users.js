import { supabase } from '../supabaseClient'

// kind 'outlet': { email, password, outletCode, outletName }
// kind 'staff':  { email, password, fullName, role }  (role: 'operator' | 'halal')
export async function createUser(kind, fields) {
  const { data, error } = await supabase.functions.invoke('create-user', { body: { kind, ...fields } })
  if (error) {
    let message = 'Could not add the user. Please try again.'
    try { message = (await error.context.json()).error || message } catch { /* keep default */ }
    throw new Error(message)
  }
  return data
}
