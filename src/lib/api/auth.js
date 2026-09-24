import { supabase } from '../supabaseClient'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, role, outlet_id, full_name, security_question, outlet:outlets(id, code, name)')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

// Self-service password recovery via a security question (no outbound email configured).
export async function setSecurityAnswer(question, answer) {
  const { error } = await supabase.rpc('set_security_answer', { p_question: question, p_answer: answer })
  if (error) throw error
}

export async function getSecurityQuestion(email) {
  const { data, error } = await supabase.rpc('get_security_question', { p_email: email })
  if (error) throw error
  return data
}

export async function resetPasswordWithAnswer(email, answer, newPassword) {
  const { data, error } = await supabase.rpc('reset_password_with_answer', {
    p_email: email, p_answer: answer, p_new_password: newPassword,
  })
  if (error) throw error
  if (!data) throw new Error('Incorrect answer')
}
