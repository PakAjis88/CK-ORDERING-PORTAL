import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { monthKey, monthLabel, fmtDate, todayISO } from '../../lib/format'
import { listStockReports, isStockWindowOpen, setStockWindowOverride, reopenStockReport, submitStockReportForOutlet } from '../../lib/api/stock'
import { downloadCsv } from '../../lib/csv'
import { Select, Stat, Empty } from '../../components/ui'
import StockReportForm from '../../components/StockReportForm'

export default function StockTracker({ outlets, products }) {
  const { t } = useT()
  const [month, setMonth] = useState(monthKey(todayISO()))
  const [submitted, setSubmitted] = useState([])
  const [open, setOpen] = useState(null)
  const [windowOpen, setWindowOpen] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [reopening, setReopening] = useState(null)
  const [reopenTarget, setReopenTarget] = useState(null)
  const [entryTarget, setEntryTarget] = useState(null)
  const [entryRows, setEntryRows] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const months = useMemo(() => { const s = new Set(submitted.map((x) => x.report_month)); s.add(monthKey(todayISO())); return [...s].sort().reverse() }, [submitted])

  const refresh = () => {
    listStockReports(month).then(setSubmitted)
    isStockWindowOpen().then(setWindowOpen)
  }
  useEffect(refresh, [month])

  const ids = new Set(submitted.map((s) => s.outlet_id))
  const outstanding = outlets.filter((o) => !ids.has(o.id))

  const toggleOverride = async () => {
    setToggling(true)
    try { await setStockWindowOverride(!windowOpen); setWindowOpen(await isStockWindowOpen()) }
    finally { setToggling(false) }
  }

  const confirmReopen = async () => {
    const s = reopenTarget
    setReopenTarget(null)
    setReopening(s.id)
    try { await reopenStockReport(s.outlet_id, s.report_month); refresh() }
    finally { setReopening(null) }
  }

  const openEntry = (outlet) => {
    setEntryRows(Object.fromEntries(products.map((p) => [p.id, { qty: '', expiry: '', qty2: '', expiry2: '' }])))
    setEntryTarget(outlet)
  }
  const setEntryRow = (pid, field, v) => setEntryRows((r) => ({ ...r, [pid]: { ...r[pid], [field]: v } }))
  const submitEntry = async (lines) => {
    setSubmitting(true)
    try { await submitStockReportForOutlet(entryTarget.id, month, lines); setEntryTarget(null); refresh() }
    finally { setSubmitting(false) }
  }

  // A zero-quantity batch with no recorded expiry gets remarked with the
  // report's own submission date instead of being left blank — there's
  // nothing to give a "nearest expiry" for when there's no stock at all.
  const lineText = (qty, expiry, submittedAt) =>
    !expiry && qty === 0
      ? t('unitsOutOfStock', { qty, date: fmtDate(submittedAt.slice(0, 10)) })
      : t('unitsExp', { qty, date: fmtDate(expiry) })

  const csvExpiry = (qty, expiry, submittedAt) =>
    !expiry && qty === 0 ? t('outOfStockRemark', { date: fmtDate(submittedAt.slice(0, 10)) }) : (expiry || '')

  const exportCsv = () => {
    const head = ['Outlet', 'Month', 'Submitted', 'Product', 'Batch1 Qty', 'Batch1 Expiry', 'Batch2 Qty', 'Batch2 Expiry']
    const out = [head.join(',')]
    submitted.forEach((s) => s.lines.forEach((l) => out.push([
      `"${s.outlet.name}"`, s.report_month, s.submitted_at.slice(0, 10), `"${l.product.name}"`,
      l.qty_on_hand, `"${csvExpiry(l.qty_on_hand, l.nearest_expiry, s.submitted_at)}"`,
      l.qty_on_hand_2 ?? '', `"${csvExpiry(l.qty_on_hand_2, l.nearest_expiry_2, s.submitted_at)}"`,
    ].join(','))))
    downloadCsv(out.join('\n'), `ck-stock-${month}.csv`)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label={t('statOutlets')} value={outlets.length} />
        <Stat label={t('statSubmitted')} value={submitted.length} tone="good" />
        <Stat label={t('statOutstanding')} value={outstanding.length} tone={outstanding.length ? 'warn' : 'good'} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Select value={month} onChange={setMonth} label={t('month')} options={months.map((m) => [m, monthLabel(m)])} />
        <button
          onClick={toggleOverride} disabled={toggling}
          className="text-xs bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {toggling ? '…' : windowOpen ? t('overrideToggleOff') : t('overrideToggleOn')}
        </button>
        <button onClick={exportCsv} disabled={submitted.length === 0} className="ml-auto text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg font-medium">{t('exportCsv')}</button>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('submittedN', { n: submitted.length })}</div>
          <div className="space-y-2">
            {submitted.length === 0 && <Empty>{t('noSubs', { month: monthLabel(month) })}</Empty>}
            {submitted.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl">
                <button onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-sm font-medium">{s.outlet.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{fmtDate(s.submitted_at.slice(0, 10))}</span>
                </button>
                {open === s.id && (
                  <div className="px-4 pb-3 space-y-1 border-t border-slate-100 pt-2">
                    {s.lines.map((l) => (
                      <div key={l.product_id} className="flex justify-between gap-3 text-xs">
                        <span className="text-slate-600">{l.product.name}</span>
                        <span className="font-mono text-slate-500 text-right">
                          {lineText(l.qty_on_hand, l.nearest_expiry, s.submitted_at)}
                          {l.qty_on_hand_2 != null && <> · {lineText(l.qty_on_hand_2, l.nearest_expiry_2, s.submitted_at)}</>}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => setReopenTarget(s)} disabled={reopening === s.id}
                      className="mt-2 text-xs text-amber-700 border border-amber-300 hover:bg-amber-50 disabled:opacity-50 px-2.5 py-1 rounded-md font-medium"
                    >
                      {reopening === s.id ? '…' : t('reopenReport')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('outstandingN', { n: outstanding.length })}</div>
          <div className="bg-white border border-slate-200 rounded-xl p-2 max-h-[420px] overflow-y-auto">
            {outstanding.length === 0
              ? <p className="text-sm text-emerald-700 p-3">{t('allReported')}</p>
              : outstanding.map((o) => (
                <button
                  key={o.id} onClick={() => openEntry(o)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border-b border-slate-50 last:border-0 hover:bg-slate-50 text-left"
                >
                  <span>{o.name}</span>
                  <span className="text-xs font-mono text-amber-600">{t('outstanding')}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
            <h3 className="font-semibold mb-2">{t('reopenReport')}</h3>
            <p className="text-sm text-slate-600 mb-4">{t('reopenConfirm', { outlet: reopenTarget.outlet.name })}</p>
            <div className="flex gap-2">
              <button onClick={() => setReopenTarget(null)} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t('reopenCancel')}</button>
              <button onClick={confirmReopen} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2.5 rounded-lg">{t('reopenYes')}</button>
            </div>
          </div>
        </div>
      )}

      {entryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold">{t('manualEntryTitle', { outlet: entryTarget.name })}</h3>
              <button onClick={() => setEntryTarget(null)} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium">{t('cancel')}</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <StockReportForm
                products={products} rows={entryRows} setRow={setEntryRow}
                editable saving={submitting} onSubmit={submitEntry}
                submitLabel={t('manualEntrySubmit', { outlet: entryTarget.name })}
                fixedMobileBar={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
