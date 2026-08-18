import { useEffect, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { monthKey, monthLabel, todayISO, fmtDate } from '../../lib/format'
import { isStockWindowOpen, getMyStockReport, submitStockReport } from '../../lib/api/stock'
import { Th, Td } from '../../components/ui'

export default function StockReport({ products }) {
  const { t, catName } = useT()
  const month = monthKey(todayISO())
  const [windowOpen, setWindowOpen] = useState(null)
  const [existing, setExisting] = useState(null)
  const [rows, setRows] = useState(() => Object.fromEntries(products.map((p) => [p.id, { qty: '', expiry: '' }])))
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
          report.lines.forEach((l) => { next[l.product_id] = { qty: String(l.qty_on_hand), expiry: l.nearest_expiry || '' } })
          return next
        })
      }
    })
    return () => { cancelled = true }
  }, [month])

  const setRow = (pid, field, v) => setRows((r) => ({ ...r, [pid]: { ...r[pid], [field]: v } }))

  const submit = async () => {
    const lines = products
      .filter((p) => rows[p.id].qty !== '' && Number(rows[p.id].qty) >= 0)
      .map((p) => ({ productId: p.id, qtyOnHand: Number(rows[p.id].qty), nearestExpiry: rows[p.id].expiry || null }))
    if (lines.length === 0) return
    setSaving(true)
    try {
      await submitStockReport(lines)
      setExisting({ submitted_at: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  const editable = windowOpen === true

  return (
    <div className="pb-24 lg:pb-0">
      <div className={`rounded-xl px-4 py-3 mb-4 text-sm border ${editable ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {windowOpen === null ? '…' : editable ? t('windowOpen', { month: monthLabel(month) }) : t('windowClosed')}
      </div>
      {existing && <div className="text-xs text-slate-500 mb-3">{t('alreadySubmitted', { date: fmtDate(existing.submitted_at?.slice(0, 10)) })}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><Th>{t('colProduct')}</Th><Th right>{t('qtyOnHand')}</Th><Th>{t('nearestExpiry')}</Th></tr></thead>
          <tbody>
            {CAT_ORDER.flatMap((cat) => [
              <tr key={'h' + cat} className="bg-slate-50/70">
                <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-t border-slate-100">{catName(cat)}</td>
              </tr>,
              ...products.filter((p) => p.category === cat).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <Td>{p.name}</Td>
                  <Td right>
                    <input
                      disabled={!editable} value={rows[p.id]?.qty ?? ''}
                      onChange={(e) => setRow(p.id, 'qty', e.target.value.replace(/\D/g, ''))}
                      placeholder="0" inputMode="numeric"
                      className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </Td>
                  <Td>
                    <input
                      type="date" disabled={!editable} value={rows[p.id]?.expiry ?? ''}
                      onChange={(e) => setRow(p.id, 'expiry', e.target.value)}
                      className="border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </Td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        <div className="hidden lg:block p-3 border-t border-slate-200">
          <button
            onClick={submit} disabled={!editable || saving}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            {saving ? '…' : t('submitStock')}
          </button>
        </div>
      </div>

      {/* Mobile: submit stays reachable without scrolling past the whole table */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <button
          onClick={submit} disabled={!editable || saving}
          className="w-full max-w-6xl mx-auto block bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
        >
          {saving ? '…' : t('submitStock')}
        </button>
      </div>
    </div>
  )
}
