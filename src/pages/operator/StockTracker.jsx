import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { monthKey, monthLabel, fmtDate, todayISO } from '../../lib/format'
import { listStockReports, isStockWindowOpen, setStockWindowOverride } from '../../lib/api/stock'
import { downloadCsv } from '../../lib/csv'
import { Select, Stat, Empty } from '../../components/ui'

export default function StockTracker({ outlets }) {
  const { t } = useT()
  const [month, setMonth] = useState(monthKey(todayISO()))
  const [submitted, setSubmitted] = useState([])
  const [open, setOpen] = useState(null)
  const [windowOpen, setWindowOpen] = useState(null)
  const [toggling, setToggling] = useState(false)

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

  const exportCsv = () => {
    const head = ['Outlet', 'Month', 'Submitted', 'Product', 'Batch1 Qty', 'Batch1 Expiry', 'Batch2 Qty', 'Batch2 Expiry']
    const out = [head.join(',')]
    submitted.forEach((s) => s.lines.forEach((l) => out.push([
      `"${s.outlet.name}"`, s.report_month, s.submitted_at.slice(0, 10), `"${l.product.name}"`,
      l.qty_on_hand, l.nearest_expiry || '', l.qty_on_hand_2 ?? '', l.nearest_expiry_2 || '',
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
                          {t('unitsExp', { qty: l.qty_on_hand, date: fmtDate(l.nearest_expiry) })}
                          {l.qty_on_hand_2 != null && <> · {t('unitsExp', { qty: l.qty_on_hand_2, date: fmtDate(l.nearest_expiry_2) })}</>}
                        </span>
                      </div>
                    ))}
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
                <div key={o.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-slate-50 last:border-0">
                  <span>{o.name}</span>
                  <span className="text-xs font-mono text-amber-600">{t('outstanding')}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
