import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useAuth } from '../../lib/AuthContext'
import { monthKey, monthLabel, todayISO, fmtDate } from '../../lib/format'
import { isStockWindowOpen, getMyStockReport, submitStockReport } from '../../lib/api/stock'
import StockReportForm from '../../components/StockReportForm'
import { Select } from '../../components/ui'

const blankRows = (products) => Object.fromEntries(products.map((p) => [p.id, { qty: '', expiry: '', qty2: '', expiry2: '' }]))

// Current month + the last 6, newest first — options for the history picker.
const monthOptions = () => {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return [key, monthLabel(key)]
  })
}

export default function StockReport({ products }) {
  const { t } = useT()
  const { profile } = useAuth()
  const currentMonth = monthKey(todayISO())
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const isCurrentMonth = viewMonth === currentMonth
  const draftKey = `stock-draft-${profile.outlet_id}-${currentMonth}`
  const [windowOpen, setWindowOpen] = useState(null)
  const [existing, setExisting] = useState(null)
  const [rows, setRows] = useState(() => blankRows(products))
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setRows(blankRows(products))
    Promise.all([isStockWindowOpen(), getMyStockReport(viewMonth)]).then(([open, report]) => {
      if (cancelled) return
      setWindowOpen(open)
      setExisting(report)
      if (report) {
        setRows((r) => {
          const next = { ...r }
          report.lines.forEach((l) => {
            next[l.product_id] = {
              qty: String(l.qty_on_hand),
              expiry: l.nearest_expiry || '',
              qty2: l.qty_on_hand_2 != null ? String(l.qty_on_hand_2) : '',
              expiry2: l.nearest_expiry_2 || '',
            }
          })
          return next
        })
      } else if (viewMonth === currentMonth) {
        try {
          const draft = localStorage.getItem(draftKey)
          if (draft) setRows(JSON.parse(draft))
        } catch { /* ignore unavailable/corrupt storage */ }
      }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [viewMonth])

  const setRow = (pid, field, v) => setRows((r) => ({ ...r, [pid]: { ...r[pid], [field]: v } }))

  // Auto-save a draft while the current month's form is editable, so a
  // refresh or dropped connection mid-entry doesn't lose everything typed.
  // Guarded by `loaded` so this can't fire before the initial fetch/restore
  // above completes and overwrite a real draft with the blank starting state.
  useEffect(() => {
    if (!loaded || !isCurrentMonth || !(windowOpen === true && !existing)) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(rows))
    } catch { /* ignore unavailable storage */ }
  }, [rows, loaded, isCurrentMonth, windowOpen, existing, draftKey])

  const submit = async (lines) => {
    setSaving(true)
    try {
      await submitStockReport(lines)
      setExisting({ submitted_at: new Date().toISOString() })
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    } finally {
      setSaving(false)
    }
  }

  const locked = isCurrentMonth && windowOpen === true && !!existing
  const editable = isCurrentMonth && windowOpen === true && !existing

  const bannerText = !isCurrentMonth
    ? (existing
        ? t('alreadySubmitted', { date: fmtDate(existing.submitted_at?.slice(0, 10)) })
        : t('noSubmissionThisMonth', { month: monthLabel(viewMonth) }))
    : windowOpen === null ? '…' : locked ? t('reportLocked') : editable ? t('windowOpen', { month: monthLabel(currentMonth) }) : t('windowClosed')

  return (
    <div>
      <div className="mb-4">
        <Select value={viewMonth} onChange={setViewMonth} label={t('month')} options={monthOptions()} />
      </div>
      <div className={`rounded-xl px-4 py-3 mb-4 text-sm border ${editable ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {bannerText}
      </div>
      {isCurrentMonth && existing && <div className="text-xs text-slate-500 mb-3">{t('alreadySubmitted', { date: fmtDate(existing.submitted_at?.slice(0, 10)) })}</div>}
      <StockReportForm
        products={products} rows={rows} setRow={setRow}
        editable={editable} saving={saving} onSubmit={submit} submitLabel={t('submitStock')}
      />
    </div>
  )
}
