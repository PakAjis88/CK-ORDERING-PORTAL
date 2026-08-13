import { useMemo, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { fmt } from '../../lib/format'
import { outstandingFor } from '../../lib/orderStatus'
import { Thumb, CatHeader, StepBtn } from '../../components/ui'

export default function OrderForm({ products, orders, editOrder, onSubmit, onUpdate, onCancelEdit }) {
  const { t, catName } = useT()
  const editing = !!editOrder
  const [qty, setQty] = useState(() => {
    const q = {}
    if (editOrder) editOrder.order_lines.forEach((l) => { q[l.product_id] = l.cartons_ordered })
    return q
  })
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setCartons = (pid, v) => setQty((q) => ({ ...q, [pid]: Math.max(0, Math.min(999, v || 0)) }))
  const bumpCartons = (pid, delta) => setQty((q) => ({ ...q, [pid]: Math.max(0, Math.min(999, (q[pid] || 0) + delta)) }))

  const outstanding = useMemo(() => (editing ? [] : outstandingFor(orders)), [orders, editing])
  const outMap = Object.fromEntries(outstanding.map((o) => [o.productId, o]))

  const lines = useMemo(
    () => products.filter((p) => (qty[p.id] || 0) > 0).map((p) => ({
      productId: p.id, cartons: qty[p.id], product: p, lineValue: Number(p.carton_price) * qty[p.id],
    })),
    [qty, products]
  )
  const total = lines.reduce((s, l) => s + l.lineValue, 0)
  const totalCartons = lines.reduce((s, l) => s + l.cartons, 0)

  const doSubmit = async (isReorder) => {
    setSubmitting(true)
    try {
      if (editing) await onUpdate(editOrder.id, lines)
      else await onSubmit(lines, isReorder)
    } finally {
      setSubmitting(false)
    }
  }

  const attempt = () => {
    if (lines.length === 0) return
    if (editing) { doSubmit(false); return }
    const overlap = lines.filter((l) => outMap[l.productId]).map((l) => outMap[l.productId])
    if (overlap.length > 0) { setModal({ overlap }); return }
    doSubmit(false)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        {editing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-indigo-900">{t('editingBanner', { orderNo: editOrder.order_no })}</span>
            <button onClick={onCancelEdit} className="text-xs text-indigo-700 hover:underline whitespace-nowrap">{t('editBack')}</button>
          </div>
        )}
        {!editing && outstanding.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 text-lg leading-none">⚠</span>
              <div>
                <div className="text-sm font-semibold text-amber-900">{t('awaitingTitle')}</div>
                <p className="text-xs text-amber-800 mt-0.5">{t('awaitingDesc')}</p>
                <ul className="mt-2 space-y-1">
                  {outstanding.map((o) => (
                    <li key={o.productId} className="text-xs text-amber-900 font-mono">
                      {t('awaitingItem', { name: o.product?.name, c: o.cartons, orders: o.orderNos.join(', ') })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {CAT_ORDER.map((cat) => (
          <div key={cat}>
            <CatHeader>{catName(cat)}</CatHeader>
            <div className="space-y-2">
              {products.filter((p) => p.category === cat).map((p) => {
                const c = qty[p.id] || 0
                const pending = outMap[p.id]
                return (
                  <div key={p.id} className={`bg-white border rounded-xl p-3 ${pending ? 'border-amber-300' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                      <Thumb />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {t('perCarton', { price: fmt(p.carton_price), n: p.units_per_carton, unit: p.units_per_carton > 1 ? t('unitP') : t('unitS') })}
                        </div>
                        {pending && <div className="text-[11px] text-amber-700 font-mono mt-0.5">⚠ {pending.cartons} {t('colCartons').toLowerCase()} {t('outstanding')}</div>}
                      </div>
                      <div className="text-right font-mono text-sm w-24 shrink-0 text-slate-700">{c > 0 ? fmt(p.carton_price * c) : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-14">
                      <StepBtn onClick={() => bumpCartons(p.id, -1)}>−</StepBtn>
                      <input
                        value={c}
                        onChange={(e) => setCartons(p.id, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                        className="w-14 text-center border border-slate-300 rounded-md py-1.5 font-mono text-sm"
                        inputMode="numeric"
                      />
                      <StepBtn onClick={() => bumpCartons(p.id, 1)}>+</StepBtn>
                      <span className="text-xs font-semibold tracking-wide text-slate-400">{t('cartonLabel')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:sticky lg:top-4">
          <div className="text-sm font-semibold mb-3">{t('orderSummary')}</div>
          {lines.length === 0 ? <p className="text-sm text-slate-500">{t('orderEmpty')}</p> : (
            <div className="space-y-1.5 mb-3">
              {lines.map((l) => (
                <div key={l.productId} className="flex justify-between text-xs">
                  <span className="text-slate-600 truncate pr-2">{l.product.name} <span className="font-mono">×{l.cartons}</span></span>
                  <span className="font-mono text-slate-700 shrink-0">{fmt(l.lineValue)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 text-sm text-slate-500">{t('itemsCartons', { n: lines.length, c: totalCartons })}</div>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-sm text-slate-500">{t('estValue')}</span>
            <span className="font-mono font-semibold text-lg">{fmt(total)}</span>
          </div>
          <button
            onClick={attempt} disabled={lines.length === 0 || submitting}
            className="w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            {submitting ? '…' : editing ? t('saveChanges') : t('placeOrder')}
          </button>
        </div>
      </div>

      {modal && (
        <ReorderModal
          overlap={modal.overlap}
          onConfirm={() => { setModal(null); doSubmit(true) }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ReorderModal({ overlap, onConfirm, onCancel }) {
  const { t } = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg">⚠</span>
          <h3 className="font-semibold">{t('reorderModalTitle')}</h3>
        </div>
        <p className="text-sm text-slate-600">{t('reorderModalBody')}</p>
        <ul className="my-3 space-y-1 bg-slate-50 rounded-lg p-3">
          {overlap.map((o) => (
            <li key={o.productId} className="text-xs font-mono text-slate-700 flex justify-between">
              <span className="truncate pr-2">{o.product?.name}</span>
              <span className="shrink-0 text-amber-700">{o.cartons} · {o.orderNos.join(', ')}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600 mb-4">{t('reorderModalQ')}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t('reorderCancel')}</button>
          <button onClick={onConfirm} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg">{t('reorderConfirm')}</button>
        </div>
      </div>
    </div>
  )
}
