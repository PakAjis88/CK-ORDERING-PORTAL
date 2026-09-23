import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { monthKey, monthLabel, todayISO, fmtDate } from '../../lib/format'
import { isStockWindowOpen, getMyStockReport, submitStockReport } from '../../lib/api/stock'
import StockReportForm from '../../components/StockReportForm'

export default function StockReport({ products }) {
  const { t } = useT()
  const month = monthKey(todayISO())
  const [windowOpen, setWindowOpen] = useState(null)
  const [existing, setExisting] = useState(null)
  const [rows, setRows] = useState(() => Object.fromEntries(products.map((p) => [p.id, { qty: '', expiry: '', qty2: '', expiry2: '' }])))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([isStockWindowOpen(), getMyStockReport(month)]).then(([open, report]) => {
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
      }
    })
    return () => { cancelled = true }
  }, [month])

  const setRow = (pid, field, v) => setRows((r) => ({ ...r, [pid]: { ...r[pid], [field]: v } }))

  const submit = async (lines) => {
    setSaving(true)
    try {
      await submitStockReport(lines)
      setExisting({ submitted_at: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  const locked = windowOpen === true && !!existing
  const editable = windowOpen === true && !existing

  return (
    <div>
      <div className={`rounded-xl px-4 py-3 mb-4 text-sm border ${editable ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {windowOpen === null ? '…' : locked ? t('reportLocked') : editable ? t('windowOpen', { month: monthLabel(month) }) : t('windowClosed')}
      </div>
      {existing && <div className="text-xs text-slate-500 mb-3">{t('alreadySubmitted', { date: fmtDate(existing.submitted_at?.slice(0, 10)) })}</div>}
      <StockReportForm
        products={products} rows={rows} setRow={setRow}
        editable={editable} saving={saving} onSubmit={submit} submitLabel={t('submitStock')}
      />
    </div>
  )
}
