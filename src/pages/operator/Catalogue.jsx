import { useRef, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { fmt } from '../../lib/format'
import { uploadProductPhoto, deleteProductPhoto } from '../../lib/api/productPhotos'
import { upsertProduct } from '../../lib/api/products'
import { CatHeader, Thumb } from '../../components/ui'

const blankForm = { id: null, code: '', name: '', category: CAT_ORDER[0], unitPrice: '', unitsPerCarton: '' }

export default function Catalogue({ products, onChanged }) {
  const { t, catName } = useT()
  const [busyId, setBusyId] = useState(null)
  const fileInputs = useRef({})
  const [form, setForm] = useState(null) // null = modal closed
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const handleFile = async (product, file) => {
    if (!file) return
    setBusyId(product.id)
    try {
      await uploadProductPhoto(product, file)
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (product) => {
    setBusyId(product.id)
    try {
      await deleteProductPhoto(product)
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const openAdd = () => { setForm({ ...blankForm }); setFormError('') }
  const openEdit = (p) => {
    setForm({ id: p.id, code: p.code, name: p.name, category: p.category, unitPrice: String(p.unit_price), unitsPerCarton: String(p.units_per_carton) })
    setFormError('')
  }
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const save = async () => {
    setSaving(true)
    setFormError('')
    try {
      await upsertProduct({
        id: form.id,
        code: form.code.trim(),
        name: form.name.trim(),
        category: Number(form.category),
        unitPrice: Number(form.unitPrice),
        unitsPerCarton: Number(form.unitsPerCarton),
      })
      setForm(null)
      await onChanged()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg">
          + {t('addProduct')}
        </button>
      </div>

      {CAT_ORDER.map((cat) => (
        <div key={cat}>
          <CatHeader>{catName(cat)}</CatHeader>
          <div className="space-y-2 mb-4">
            {products.filter((p) => p.category === cat).map((p) => {
              const busy = busyId === p.id
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <Thumb src={p.photo_url} alt={p.name} size={14} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.code} · {fmt(p.unit_price)} · {p.units_per_carton}/carton</div>
                  </div>
                  <input
                    ref={(el) => { fileInputs.current[p.id] = el }}
                    type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => handleFile(p, e.target.files?.[0])}
                  />
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-md font-medium"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => fileInputs.current[p.id]?.click()} disabled={busy}
                      className="text-xs border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-2.5 py-1.5 rounded-md font-medium"
                    >
                      {busy ? '…' : p.photo_url ? t('changePhoto') : t('uploadPhoto')}
                    </button>
                    {p.photo_url && (
                      <button
                        onClick={() => handleDelete(p)} disabled={busy}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 px-2.5 py-1.5 rounded-md font-medium"
                      >
                        {t('deletePhoto')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
            <h3 className="font-semibold mb-4">{form.id ? t('edit') : t('addProduct')}</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">{t('productCode')}</span>
                <input
                  value={form.code} disabled={!!form.id}
                  onChange={(e) => setField('code', e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">{t('productName')}</span>
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">{t('category')}</span>
                <select
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm bg-white"
                >
                  {CAT_ORDER.map((c) => <option key={c} value={c}>{catName(c)}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">{t('unitPrice')}</span>
                  <input
                    type="number" step="0.01" min="0" value={form.unitPrice}
                    onChange={(e) => setField('unitPrice', e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('unitsPerCarton')}</span>
                  <input
                    type="number" step="1" min="1" value={form.unitsPerCarton}
                    onChange={(e) => setField('unitsPerCarton', e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm font-mono"
                  />
                </label>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 mt-3">{formError}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setForm(null)} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t('cancel')}</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">{saving ? '…' : t('saveChanges')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
