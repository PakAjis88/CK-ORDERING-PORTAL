import { useEffect, useState } from 'react'
import { getProductRecipe, saveProductRecipe } from '../../lib/api/materials'

const BASIS_OPTIONS = [
  ['carton', 'Per carton'],
  ['unit', 'Per unit'],
  ['batch', 'Per batch'],
]

const blankLine = () => ({ rawMaterialId: '', qty: '', basis: 'carton' })

export default function RecipeModal({ product, rawMaterials, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [batchYield, setBatchYield] = useState('')
  const [lines, setLines] = useState([blankLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getProductRecipe(product.id).then((recipe) => {
      if (recipe) {
        setBatchYield(String(recipe.batchYield))
        setLines(recipe.lines.length ? recipe.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: String(l.qty), basis: l.basis })) : [blankLine()])
      }
      setLoading(false)
    })
  }, [product.id])

  const setLine = (i, field, value) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  const addLine = () => setLines((ls) => [...ls, blankLine()])
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const save = async () => {
    setError('')
    const validLines = lines.filter((l) => l.rawMaterialId && l.qty !== '')
    if (!batchYield || Number(batchYield) <= 0) { setError('Batch yield must be greater than 0'); return }
    if (validLines.length === 0) { setError('Add at least one raw material line'); return }
    setSaving(true)
    try {
      await saveProductRecipe(product.id, Number(batchYield), validLines.map((l) => ({ ...l, qty: Number(l.qty) })))
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold">Recipe — {product.name}</h3>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium">Close</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="text-sm text-slate-400 p-6 text-center">…</div>
          ) : (
            <>
              <label className="block mb-4">
                <span className="text-xs text-slate-500">Batch yield (finished packs per batch)</span>
                <input
                  type="number" min="1" value={batchYield} onChange={(e) => setBatchYield(e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm font-mono"
                />
              </label>

              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Raw materials</div>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-center">
                    <select
                      value={line.rawMaterialId} onChange={(e) => setLine(i, 'rawMaterialId', e.target.value)}
                      className="border border-slate-300 rounded-md py-1.5 px-2 text-sm bg-white"
                    >
                      <option value="">Select material…</option>
                      {rawMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </select>
                    <input
                      type="number" min="0" step="0.01" placeholder="Qty" value={line.qty}
                      onChange={(e) => setLine(i, 'qty', e.target.value)}
                      className="border border-slate-300 rounded-md py-1.5 px-2 text-sm font-mono"
                    />
                    <select
                      value={line.basis} onChange={(e) => setLine(i, 'basis', e.target.value)}
                      className="border border-slate-300 rounded-md py-1.5 px-2 text-sm bg-white"
                    >
                      {BASIS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button onClick={() => removeLine(i)} className="text-red-500 text-sm px-1">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addLine} className="mt-2 text-xs text-teal-700 border border-teal-300 hover:bg-teal-50 px-2.5 py-1 rounded-md font-medium">+ Add line</button>

              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={onClose} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                  {saving ? '…' : 'Save recipe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
