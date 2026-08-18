import { useRef, useState } from 'react'
import { useT, CAT_ORDER } from '../../lib/i18n'
import { uploadProductPhoto, deleteProductPhoto } from '../../lib/api/productPhotos'
import { CatHeader, Thumb } from '../../components/ui'

export default function Catalogue({ products, onChanged }) {
  const { t, catName } = useT()
  const [busyId, setBusyId] = useState(null)
  const fileInputs = useRef({})

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

  return (
    <div>
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
                    <div className="text-xs text-slate-400 font-mono">{p.code}</div>
                  </div>
                  <input
                    ref={(el) => { fileInputs.current[p.id] = el }}
                    type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => handleFile(p, e.target.files?.[0])}
                  />
                  <div className="flex gap-2 shrink-0">
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
    </div>
  )
}
