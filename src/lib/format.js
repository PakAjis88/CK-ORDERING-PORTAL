export const CYCLE_DAYS = 30
export const EDIT_DAYS = 3

export const fmt = (n) => 'RM ' + Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Month names always render in English regardless of active UI language —
// explicit confirmed rule (brief section 6), do not switch to locale-based
// month formatting.
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export const monthKey = (iso) => iso.slice(0, 7)
export const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d }
export const dueDate = (order) => addDays(order.order_date, CYCLE_DAYS)
export const daysSince = (iso, now) => Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / 86400000)
export const todayISO = () => new Date().toISOString().slice(0, 10)
