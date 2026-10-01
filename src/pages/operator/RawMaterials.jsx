import { useState } from 'react'
import { upsertRawMaterial, setRawMaterialStock } from '../../lib/api/materials'

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs']
const blankForm = { id: null, code: '', name: '', unit: 'kg', packSize: '1' }

export default function RawMaterials({ rawMaterials, onChanged }) {
  const [form, setForm] = useState(null) // null = add/edit modal closed
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [stockEdits, setStockEdits] = useState({}) // id -> draft value while editing inline
  const [savingStockId, setSavingStockId] = useState(null)

  const openAdd = () => { setForm({ ...blankForm }); setFormError('') }
  const openEdit = (m) => { setForm({ id: m.id, code: m.code, name: m.name, unit: m.unit, packSize: String(m.packSize) }); setFormError('') }
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const save = async () => {
    setSaving(true)
    setFormError('')
    try {
      await upsertRawMaterial({
        id: form.id, code: form.code.trim(), name: form.name.trim(),
        unit: form.unit, packSize: Number(form.packSize),
      })
      setForm(null)
      await onChanged()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const saveStock = async (m) => {
    const value = stockEdits[m.id]
    if (value === undefined || value === '') return
    setSavingStockId(m.id)
    try {
      await setRawMaterialStock(m.id, Number(value))
      setStockEdits((s) => { const next = { ...s }; delete next[m.id]; return next })
      await onChanged()
    } finally {
      setSavingStockId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg">
          + Add raw material
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Code</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Unit</th>
              <th className="px-4 py-2 text-right font-medium">Pack size</th>
              <th className="px-4 py-2 text-right font-medium">Stock on hand</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rawMaterials.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{m.code}</td>
                <td className="px-4 py-2.5">{m.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{m.unit}</td>
                <td className="px-4 py-2.5 text-right font-mono">{m.packSize}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <input
                      value={stockEdits[m.id] ?? m.stockOnHand}
                      onChange={(e) => setStockEdits((s) => ({ ...s, [m.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                      className="w-20 text-right border border-slate-300 rounded-md py-1 px-2 font-mono text-sm"
                    />
                    <button
                      onClick={() => saveStock(m)} disabled={savingStockId === m.id || stockEdits[m.id] === undefined}
                      className="text-xs border border-slate-300 hover:bg-slate-50 disabled:opacity-40 px-2 py-1 rounded-md font-medium"
                    >
                      {savingStockId === m.id ? '…' : 'Save'}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => openEdit(m)} className="text-xs border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-md font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
            <h3 className="font-semibold mb-4">{form.id ? 'Edit raw material' : 'Add raw material'}</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">Code</span>
                <input
                  value={form.code} disabled={!!form.id}
                  onChange={(e) => setField('code', e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Name</span>
                <input
                  value={form.name} onChange={(e) => setField('name', e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Unit</span>
                  <select
                    value={form.unit} onChange={(e) => setField('unit', e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm bg-white"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Purchase pack size</span>
                  <input
                    type="number" step="0.01" min="0.01" value={form.packSize}
                    onChange={(e) => setField('packSize', e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm font-mono"
                  />
                </label>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 mt-3">{formError}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setForm(null)} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">{saving ? '…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
