import { useMemo, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { productionSummary } from '../../lib/orderStatus'
import { downloadProductionPdf } from '../../lib/productionPdf'
import { Th, Td, Stat, Empty } from '../../components/ui'

export default function Production({ orders }) {
  const { t, catName } = useT()
  const [printing, setPrinting] = useState(false)

  const rows = useMemo(() => productionSummary(orders), [orders])
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

  if (rows.length === 0) return <Empty>{t('noProduction')}</Empty>

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label={t('statProductsToProduce')} value={productsPending} tone={productsPending ? 'warn' : 'good'} />
        <Stat label={t('statCartonsToProduce')} value={cartonsToProduce} mono tone={cartonsToProduce ? 'warn' : 'good'} />
      </div>
      <div className="flex justify-end mb-3">
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
                  <Td>{r.product.name}</Td>
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
