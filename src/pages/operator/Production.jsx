import { useMemo, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { productionSummary, isFull } from '../../lib/orderStatus'
import { productSheet } from '../../lib/productionSheets'
import { downloadProductionPdf, downloadProductSheetPdf } from '../../lib/productionPdf'
import { klToday } from '../../lib/api/deliveries'
import { Th, Td, Stat, Empty } from '../../components/ui'

// Default order-date range: the last 30 days, stretched back to the oldest order that is still
// open, so an overdue order is never hidden by the default.
function defaultRange(orders) {
  const to = klToday()
  const d = new Date(`${to}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 30)
  let from = d.toISOString().slice(0, 10)
  orders.filter((o) => !o.cancelled && !isFull(o)).forEach((o) => { if (o.order_date < from) from = o.order_date })
  return { from, to }
}

export default function Production({ orders }) {
  const { t, catName } = useT()
  const [printing, setPrinting] = useState(false)
  const [range, setRange] = useState(() => defaultRange(orders))
  // the table, the summary PDF and every product sheet only look at orders inside the range
  const inRange = useMemo(
    () => orders.filter((o) => (!range.from || o.order_date >= range.from) && (!range.to || o.order_date <= range.to)),
    [orders, range]
  )
  const rows = useMemo(() => productionSummary(inRange), [inRange])
  const grouped = useMemo(
    () => CAT_ORDER.map((cat) => ({
      cat,
      items: rows
        .filter((r) => r.product.category === cat)
        .sort((a, b) => b.balance - a.balance || a.product.code.localeCompare(b.product.code)),
    })),
    [rows]
  )
  const productsPending = rows.filter((r) => r.balance > 0).length
  const cartonsToProduce = rows.reduce((s, r) => s + r.balance, 0)

  const print = () => {
    setPrinting(true)
    try {
      const sorted = grouped.flatMap((g) => g.items)
      downloadProductionPdf(sorted)
    } finally {
      setPrinting(false)
    }
  }

  const rangeBox = (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="block">
        <span className="text-xs text-slate-500">{t('prodFrom')}</span>
        <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} className="block mt-1 border border-slate-300 rounded-lg py-2 px-3 text-sm bg-white font-mono" />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{t('prodTo')}</span>
        <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} className="block mt-1 border border-slate-300 rounded-lg py-2 px-3 text-sm bg-white font-mono" />
      </label>
      <button onClick={() => setRange(defaultRange(orders))} className="text-sm text-teal-700 hover:underline pb-2.5">{t('prodReset')}</button>
    </div>
  )

  if (rows.length === 0) return <div>{rangeBox}<Empty>{t('noProduction')}</Empty></div>

  const sheetRange = { from: range.from || inRange.reduce((m, o) => (o.order_date < m ? o.order_date : m), klToday()), to: range.to || klToday() }

  return (
    <div>
      {rangeBox}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label={t('statProductsToProduce')} value={productsPending} tone={productsPending ? 'warn' : 'good'} />
        <Stat label={t('statCartonsToProduce')} value={cartonsToProduce} mono tone={cartonsToProduce ? 'warn' : 'good'} />
      </div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-slate-500">{t('prodSheetHint')}</p>
        <button
          onClick={print} disabled={printing}
          className="text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
        >
          {printing ? '…' : t('printProduction')}
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr><Th>{t('colProduct')}</Th><Th right>{t('ordered')}</Th><Th right>{t('colDelivered')}</Th><Th right>{t('balanceToProduce')}</Th></tr>
          </thead>
          <tbody>
            {grouped.flatMap(({ cat, items }) => (items.length === 0 ? [] : [
              <tr key={'h' + cat} className="bg-slate-50/70">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-t border-slate-100">{catName(cat)}</td>
              </tr>,
              ...items.map((r) => (
                <tr key={r.productId} className="border-t border-slate-100">
                  <Td>
                    <button
                      onClick={() => downloadProductSheetPdf(productSheet(inRange, r.productId), r.product, sheetRange)}
                      title={t('prodSheetHint')} className="text-left text-teal-700 hover:underline"
                    >
                      {r.product.name}
                    </button>
                    <span className="ml-1.5 text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1 py-0.5 align-middle">PDF</span>
                  </Td>
                  <Td right mono>{r.ordered}</Td>
                  <Td right mono>{r.delivered}</Td>
                  <Td right mono>
                    <span className={r.balance > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>{r.balance}</span>
                  </Td>
                </tr>
              )),
            ]))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
