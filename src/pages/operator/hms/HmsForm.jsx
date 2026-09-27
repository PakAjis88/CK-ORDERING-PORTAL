import { useState } from 'react'

// Labels are the document's own bilingual wording, shown as-is regardless of
// the app's language toggle — this is an official controlled document
// (HM9-F4b..f), not app copy that should translate.
const SENSORY_ATTRS = [
  { key: 'colour', label: 'WARNA / COLOUR' },
  { key: 'odour', label: 'BAU / ODOUR' },
  { key: 'appearance', label: 'RUPA / APPEARANCE' },
  { key: 'taste', label: 'RASA / TASTE' },
]

function blankPayload() {
  return {
    production_date: '', product_weight: '',
    products: [], materials: [],
    sensory: { colour: { staff: '', qa: '' }, odour: { staff: '', qa: '' }, appearance: { staff: '', qa: '' }, taste: { staff: '', qa: '' }, remarks: '' },
    packing_date: '', product_expiry_date: '', total_pcs: '', total_ctn: '',
    prepared_by: '', checked_by: '',
  }
}

// Merges an existing submission's saved values onto the blank shape, and
// pre-populates the fixed product/material rows (qty/batch/expiry blank)
// so every listed item always has an input, whether or not it was used yet.
function initFromForm(form, submission) {
  const base = blankPayload()
  const productRows = form.products.length > 0
    ? form.products.map((code) => ({ code, qty: '' }))
    : []
  const materialRows = form.materials.length > 0
    ? form.materials.map((name) => ({ name, batch_no: '', expiry_date: '' }))
    : []

  if (!submission) return { ...base, products: productRows, materials: materialRows }

  const mergedProducts = form.products.length > 0
    ? productRows.map((row) => {
        const saved = (submission.products || []).find((p) => p.code === row.code)
        return saved ? { code: row.code, qty: String(saved.qty ?? '') } : row
      })
    : (submission.products || []).map((p) => ({ name: p.name, qty: String(p.qty ?? '') }))

  const mergedMaterials = form.materials.length > 0
    ? materialRows.map((row) => {
        const saved = (submission.materials || []).find((m) => m.name === row.name)
        return saved ? { name: row.name, batch_no: saved.batch_no || '', expiry_date: saved.expiry_date || '' } : row
      })
    : (submission.materials || []).map((m) => ({ name: m.name, batch_no: m.batch_no || '', expiry_date: m.expiry_date || '' }))

  return {
    production_date: submission.production_date || '',
    product_weight: submission.product_weight || '',
    products: mergedProducts,
    materials: mergedMaterials,
    sensory: {
      colour: submission.sensory?.colour || { staff: '', qa: '' },
      odour: submission.sensory?.odour || { staff: '', qa: '' },
      appearance: submission.sensory?.appearance || { staff: '', qa: '' },
      taste: submission.sensory?.taste || { staff: '', qa: '' },
      remarks: submission.sensory?.remarks || '',
    },
    packing_date: submission.packing_date || '',
    product_expiry_date: submission.product_expiry_date || '',
    total_pcs: submission.total_pcs != null ? String(submission.total_pcs) : '',
    total_ctn: submission.total_ctn != null ? String(submission.total_ctn) : '',
    prepared_by: submission.prepared_by || '',
    checked_by: submission.checked_by || '',
  }
}

function buildPayload(data, openEnded) {
  return {
    production_date: data.production_date || null,
    product_weight: data.product_weight || null,
    products: data.products
      .filter((p) => p.qty !== '' && (!openEnded || p.name))
      .map((p) => (openEnded ? { name: p.name, qty: Number(p.qty) } : { code: p.code, qty: Number(p.qty) })),
    materials: data.materials
      .filter((m) => (m.batch_no || m.expiry_date) && (!openEnded || m.name))
      .map((m) => ({ name: m.name, batch_no: m.batch_no || null, expiry_date: m.expiry_date || null })),
    sensory: data.sensory,
    packing_date: data.packing_date || null,
    product_expiry_date: data.product_expiry_date || null,
    total_pcs: data.total_pcs !== '' ? Number(data.total_pcs) : null,
    total_ctn: data.total_ctn !== '' ? Number(data.total_ctn) : null,
    prepared_by: data.prepared_by || null,
    checked_by: data.checked_by || null,
  }
}

const inputCls = 'w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm'

export default function HmsForm({ form, submission, workDate, saving, onSubmit, onCancel }) {
  const [data, setData] = useState(() => initFromForm(form, submission))
  const openEnded = form.products.length === 0 && form.materials.length === 0

  const setField = (field, value) => setData((d) => ({ ...d, [field]: value }))
  const setProductQty = (idx, qty) => setData((d) => ({ ...d, products: d.products.map((p, i) => (i === idx ? { ...p, qty } : p)) }))
  const setMaterial = (idx, field, value) => setData((d) => ({ ...d, materials: d.materials.map((m, i) => (i === idx ? { ...m, [field]: value } : m)) }))
  const setSensory = (attr, field, value) => setData((d) => ({ ...d, sensory: { ...d.sensory, [attr]: { ...d.sensory[attr], [field]: value } } }))

  const addOpenProduct = () => setData((d) => ({ ...d, products: [...d.products, { name: '', qty: '' }] }))
  const removeOpenProduct = (idx) => setData((d) => ({ ...d, products: d.products.filter((_, i) => i !== idx) }))
  const setOpenProduct = (idx, field, value) => setData((d) => ({ ...d, products: d.products.map((p, i) => (i === idx ? { ...p, [field]: value } : p)) }))

  const addOpenMaterial = () => setData((d) => ({ ...d, materials: [...d.materials, { name: '', batch_no: '', expiry_date: '' }] }))
  const removeOpenMaterial = (idx) => setData((d) => ({ ...d, materials: d.materials.filter((_, i) => i !== idx) }))
  const setOpenMaterial = (idx, field, value) => setData((d) => ({ ...d, materials: d.materials.map((m, i) => (i === idx ? { ...m, [field]: value } : m)) }))

  const submit = () => onSubmit(buildPayload(data, openEnded))

  return (
    <div className="space-y-5">
      <div className="text-xs text-slate-500 font-mono">{form.code} · {form.name} · {workDate}</div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">TARIKH PRODUCTION / PRODUCTION DATE</span>
          <input type="date" value={data.production_date} onChange={(e) => setField('production_date', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">BERAT PRODUK / PRODUCT WEIGHT</span>
          <input value={data.product_weight} onChange={(e) => setField('product_weight', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">JENIS PRODUK / TYPE OF PRODUCT</div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          {!openEnded && data.products.map((p, i) => (
            <div key={p.code} className="flex items-center gap-3">
              <span className="text-sm flex-1">{p.code}</span>
              <input
                inputMode="numeric" placeholder="0" value={p.qty}
                onChange={(e) => setProductQty(i, e.target.value.replace(/\D/g, ''))}
                className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm"
              />
            </div>
          ))}
          {openEnded && (
            <>
              {data.products.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="Product name" value={p.name} onChange={(e) => setOpenProduct(i, 'name', e.target.value)} className={inputCls + ' flex-1'} />
                  <input inputMode="numeric" placeholder="Qty" value={p.qty} onChange={(e) => setOpenProduct(i, 'qty', e.target.value.replace(/\D/g, ''))} className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm" />
                  <button onClick={() => removeOpenProduct(i)} className="text-red-500 text-sm px-2">✕</button>
                </div>
              ))}
              <button onClick={addOpenProduct} className="text-xs text-teal-700 border border-teal-300 hover:bg-teal-50 px-2.5 py-1 rounded-md font-medium">+ Add product</button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">BAHAN / MATERIAL — BATCH NO / EXPIRY DATE</div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          {!openEnded && data.materials.map((m, i) => (
            <div key={m.name} className="grid grid-cols-3 gap-2 items-center">
              <span className="text-sm">{m.name}</span>
              <input placeholder="Batch no" value={m.batch_no} onChange={(e) => setMaterial(i, 'batch_no', e.target.value)} className={inputCls} />
              <input type="date" value={m.expiry_date} onChange={(e) => setMaterial(i, 'expiry_date', e.target.value)} className={inputCls} />
            </div>
          ))}
          {openEnded && (
            <>
              {data.materials.map((m, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <input placeholder="Material name" value={m.name} onChange={(e) => setOpenMaterial(i, 'name', e.target.value)} className={inputCls} />
                  <input placeholder="Batch no" value={m.batch_no} onChange={(e) => setOpenMaterial(i, 'batch_no', e.target.value)} className={inputCls} />
                  <div className="flex gap-1">
                    <input type="date" value={m.expiry_date} onChange={(e) => setOpenMaterial(i, 'expiry_date', e.target.value)} className={inputCls} />
                    <button onClick={() => removeOpenMaterial(i)} className="text-red-500 text-sm px-2">✕</button>
                  </div>
                </div>
              ))}
              <button onClick={addOpenMaterial} className="text-xs text-teal-700 border border-teal-300 hover:bg-teal-50 px-2.5 py-1 rounded-md font-medium">+ Add material</button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">UJIAN DERIA / SENSORY TEST</div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          {SENSORY_ATTRS.map(({ key, label }) => (
            <div key={key} className="grid sm:grid-cols-3 gap-2 items-center">
              <span className="text-sm">{label}</span>
              <label className="block">
                <span className="text-xs text-slate-500">STAFF</span>
                <input value={data.sensory[key].staff} onChange={(e) => setSensory(key, 'staff', e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">{form.qa_label}</span>
                <input value={data.sensory[key].qa} onChange={(e) => setSensory(key, 'qa', e.target.value)} className={inputCls} />
              </label>
            </div>
          ))}
          <label className="block">
            <span className="text-xs text-slate-500">REMARKS</span>
            <textarea
              value={data.sensory.remarks}
              onChange={(e) => setData((d) => ({ ...d, sensory: { ...d.sensory, remarks: e.target.value } }))}
              className={inputCls} rows={2}
            />
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">TARIKH PEMBUNGKUSAN / PACKING DATE</span>
          <input type="date" value={data.packing_date} onChange={(e) => setField('packing_date', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">PRODUCT EXPIRY DATE</span>
          <input type="date" value={data.product_expiry_date} onChange={(e) => setField('product_expiry_date', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">JUMLAH KUANTITI / TOTAL FINISH GOOD</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-500">PCS</span>
            <input inputMode="numeric" value={data.total_pcs} onChange={(e) => setField('total_pcs', e.target.value.replace(/\D/g, ''))} className={inputCls + ' mt-1 font-mono'} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">CTN</span>
            <input inputMode="numeric" value={data.total_ctn} onChange={(e) => setField('total_ctn', e.target.value.replace(/\D/g, ''))} className={inputCls + ' mt-1 font-mono'} />
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">PREPARED BY — NAMA :</span>
          <input value={data.prepared_by} onChange={(e) => setField('prepared_by', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">CHECKED BY — NAMA:</span>
          <input value={data.checked_by} onChange={(e) => setField('checked_by', e.target.value)} className={inputCls + ' mt-1'} />
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
