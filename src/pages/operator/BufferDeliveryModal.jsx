import { useState } from 'react'
import { recordBufferDelivery } from '../../lib/api/orders'
import { todayISO } from '../../lib/format'

const blankLine = () => ({ productId: '', cartons: '', expiry: '' })
const fieldCls = 'w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm'

const EXTRA_LABEL = { dihantar_lebih: 'Dihantar Lebih', penghantaran_extra: 'Penghantaran Extra' }

export default function BufferDeliveryModal({ outlets, products, initialOutletId, onClose, onSaved }) {
  const [outletId, setOutletId] = useState(initialOutletId || '')
  const [date, setDate] = useState(todayISO())
  const [lines, setLines] = useState([blankLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const setLine = (i, field, value) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))

  const save = async () => {
    setError('')
    if (!outletId) { setError('Choose the outlet'); return }
    if (lines.some((l) => !l.productId || !(Number(l.cartons) > 0))) { setError('Every item needs a product and cartons above 0'); return }
    setSaving(true)
    try {
      setResult(await recordBufferDelivery(outletId, date, lines.map((l) => ({
        productId: l.productId, cartons: Number(l.cartons), expiry: l.expiry || null,
      }))))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const finish = () => (result ? onSaved() : onClose())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-1">Penghantaran Extra</h3>
        <p className="text-xs text-slate-500 mb-4">
          Items CK sent without an order. Cartons first knock off what the outlet still owes for that product (latest order first, then older). Anything beyond that is extra on the latest order and is charged at the normal price.
        </p>

        {result ? (
          <div className="space-y-3">
            {result.map((r, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 text-sm">
                <div className="font-medium">{r.product} <span className="font-mono text-slate-500">×{r.cartons}</span></div>
                {r.knocked_off.map((k, j) => (
                  <div key={j} className="text-xs text-emerald-700 mt-1">
                    Knocked off {k.cartons} on {k.order_no} (owed {k.was_owed}, now {k.was_owed - k.cartons})
                  </div>
                ))}
                {r.extra && (
                  <div className="text-xs text-violet-700 font-medium mt-1">
                    {EXTRA_LABEL[r.extra.kind]} +{r.extra.cartons} on {r.extra.order_no} (charged)
                  </div>
                )}
              </div>
            ))}
            <button onClick={finish} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg">Done</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-xs text-slate-500">Outlet</span>
                <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={`${fieldCls} mt-1 bg-white`}>
                  <option value="">Choose outlet…</option>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.code} {o.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Delivery date</span>
                <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} mt-1 font-mono`} />
              </label>
            </div>

            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <label className="col-span-6 block">
                    {i === 0 && <span className="text-xs text-slate-500">Product</span>}
                    <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)} className={`${fieldCls} mt-1 bg-white`}>
                      <option value="">Choose product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 block">
                    {i === 0 && <span className="text-xs text-slate-500">Cartons</span>}
                    <input
                      value={l.cartons} inputMode="numeric"
                      onChange={(e) => setLine(i, 'cartons', e.target.value.replace(/\D/g, ''))}
                      className={`${fieldCls} mt-1 text-right font-mono`}
                    />
                  </label>
                  <label className="col-span-3 block">
                    {i === 0 && <span className="text-xs text-slate-500">Expiry</span>}
                    <input type="date" value={l.expiry} onChange={(e) => setLine(i, 'expiry', e.target.value)} className={`${fieldCls} mt-1 font-mono text-xs`} />
                  </label>
                  <button
                    type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))}
                    disabled={lines.length === 1} className="col-span-1 text-slate-400 hover:text-red-600 disabled:opacity-30 pb-1.5" title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="text-xs text-teal-700 hover:underline mt-2">+ Add another item</button>

            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">{saving ? '…' : 'Save'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
