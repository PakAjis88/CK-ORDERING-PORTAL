import { supabase } from '../supabaseClient'

export async function listHmsForms() {
  const { data, error } = await supabase
    .from('hms_forms')
    .select('id, code, name, version, display_order, products, materials, qa_label')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return data
}

export async function listHmsSubmissionsForDate(workDate) {
  const { data, error } = await supabase.from('hms_submissions').select('*').eq('work_date', workDate)
  if (error) throw error
  return data
}

// month: 'YYYY-MM'
export async function listHmsSubmissions(month) {
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from('hms_submissions')
    .select('*')
    .gte('work_date', start)
    .lt('work_date', nextMonth)
  if (error) throw error
  return data
}

export async function submitHmsForm(formId, workDate, payload) {
  const { data, error } = await supabase.rpc('submit_hms_form', {
    p_form_id: formId, p_work_date: workDate, p_payload: payload,
  })
  if (error) throw error
  return data
}

export async function markHmsNil(formId, workDate) {
  const { data, error } = await supabase.rpc('mark_hms_nil', { p_form_id: formId, p_work_date: workDate })
  if (error) throw error
  return data
}

export async function updateHmsSubmission(id, payload) {
  const { data, error } = await supabase.rpc('update_hms_submission', { p_id: id, p_payload: payload })
  if (error) throw error
  return data
}

export async function reopenHmsSubmission(id) {
  const { error } = await supabase.rpc('reopen_hms_submission', { p_id: id })
  if (error) throw error
}

export async function listHmsHolidays() {
  const { data, error } = await supabase.from('hms_holidays').select('date, name').order('date')
  if (error) throw error
  return data
}

export async function upsertHmsHoliday(date, name) {
  const { error } = await supabase.rpc('upsert_hms_holiday', { p_date: date, p_name: name })
  if (error) throw error
}

export async function deleteHmsHoliday(date) {
  const { error } = await supabase.rpc('delete_hms_holiday', { p_date: date })
  if (error) throw error
}
