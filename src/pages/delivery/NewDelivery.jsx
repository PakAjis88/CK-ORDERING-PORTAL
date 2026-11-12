import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import ExpiryDateInput, { isValidExpiry } from '../../components/ExpiryDateInput'
import { compressPhoto, recordStaffDelivery, previewStaffDelivery, getGalleryEnabled } from '../../lib/api/deliveries'

const blankItem = () => ({ productId: '', cartons: 1, expiry: '' })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const bigBtn = 'w-full rounded-xl text-base font-semibold py-4 disabled:opacity-40'

export default function NewDelivery({ outlets, products, galleryEnabled = true }) {
  const { t } = useT()
  const [galleryOn, setGalleryOn] = useState(galleryEnabled)
  const [warn, setWarn] = useState(null) // pre-save pop-up: the extra items, or null when closed
  const [step, setStep] = useState(0) // 0 outlet, 1 products, 2 photo, 3 review
  const [outletId, setOutletId] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [photo, setPhoto] = useState(null) // { blob, url, dropId }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)

  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url) }, [photo])

  // re-read the gallery switch whenever the photo step opens, so an operator turning it off applies at once
  useEffect(() => {
    if (step !== 2) return
    getGalleryEnabled().then(setGalleryOn).catch(() => {})
  }, [step])

  const outlet = outlets.find((o) => o.id === outletId)
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const shownOutlets = outlets.filter((o) => `${o.code} ${o.name}`.toLowerCase().includes(search.trim().toLowerCase()))
  const setItem = (i, patch) => setItems((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const itemsOk = items.length > 0 && items.every((x) => x.productId && Number(x.cartons) > 0 && ISO.test(x.expiry) && isValidExpiry(x.expiry))

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const blob = await compressPhoto(file)
      // a new photo is a new delivery id, so a retake never collides with an earlier upload
      setPhoto({ blob, url: URL.createObjectURL(blob), dropId: crypto.randomUUID() })
    } catch (err) {
      setError(err.message)
    }
  }

  const save = async () => {
    setError('')
    setWarn(null)
    setSaving(true)
    try {
      setResult(await recordStaffDelivery({
        outletId, photo: photo.blob, dropId: photo.dropId,
        lines: items.map((x) => ({ productId: x.productId, cartons: Number(x.cartons), expiry: x.expiry })),
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Confirm: first ask the server (read-only) whether anything is extra; if so show the pop-up
  // and let staff choose Teruskan (save) or Kembali (go back). If the check itself fails, say so
  // and do not save, so the warning is never skipped silently.
  const confirm = async () => {
    setError('')
    setSaving(true)
    try {
      const preview = await previewStaffDelivery(outletId, items.map((x) => ({ productId: x.productId, cartons: Number(x.cartons) })))
      const extras = preview.filter((p) => p.extra > 0)
      if (extras.length > 0) { setWarn(extras); return }
    } catch (err) {
      setError(err.message)
      return
    } finally {
      setSaving(false)
    }
    await save()
  }

  const reset = () => {
    setStep(0); setOutletId(''); setSearch(''); setItems([blankItem()]); setPhoto(null); setResult(null); setError('')
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 font-semibold">✓ {t('dlSaved')} · {outlet?.code} {outlet?.name}</div>
        {result.lines.map((r, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 text-sm">
            <div className="font-medium">{r.product} <span className="font-mono text-slate-500">×{r.cartons}</span></div>
            {r.knocked_off.map((k, j) => (
              <div key={j} className="text-xs text-emerald-700 mt-1">{t('dlKnocked', { c: k.cartons, o: k.order_no, w: k.was_owed - k.cartons })}</div>
            ))}
            {r.extra && (
              <div className="text-xs text-violet-700 font-semibold mt-1">
                {t(r.extra.kind === 'penghantaran_extra' ? 'dlExtraItem' : 'dlExtraLebih', { c: r.extra.cartons, o: r.extra.order_no })}
                {r.extra.new_order && <span className="block font-normal text-violet-600">{t('dlNewOrder')}</span>}
              </div>
            )}
          </div>
        ))}
        <button onClick={reset} className={`${bigBtn} bg-teal-600 hover:bg-teal-700 text-white`}>{t('dlNewOne')}</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{[t('dlStepOutlet'), t('dlStepItems'), t('dlStepPhoto'), t('dlStepReview')][step]}</h2>
        <span className="text-xs text-slate-400">{t('dlStepOf', { n: step + 1 })}</span>
      </div>
      {step > 0 && outlet && <div className="text-sm text-slate-500 mb-3">{outlet.code} · {outlet.name}</div>}

      {step === 0 && (
        <div>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('dlSearchOutlet')}
            className="w-full border border-slate-300 rounded-xl py-3 px-4 text-base mb-3 bg-white"
          />
          <div className="space-y-2">
            {shownOutlets.map((o) => (
              <button
                key={o.id} onClick={() => { setOutletId(o.id); setStep(1) }}
                className="w-full text-left bg-white border border-slate-200 hover:border-teal-500 rounded-xl px-4 py-3.5 text-base"
              >
                <span className="font-mono text-xs text-slate-400 mr-2">{o.code}</span>{o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {items.map((x, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex gap-2">
                <select
                  value={x.productId} onChange={(e) => setItem(i, { productId: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg py-3 px-3 text-base bg-white"
                >
                  <option value="">{t('dlChooseProduct')}</option>
                  {products.filter((p) => p.id === x.productId || !items.some((y) => y.productId === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {items.length > 1 && (
                  <button onClick={() => setItems((xs) => xs.filter((_, idx) => idx !== i))} className="px-3 text-slate-400 hover:text-red-600" title={t('dlRemove')}>✕</button>
                )}
              </div>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('dlCartons')}</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setItem(i, { cartons: Math.max(1, (Number(x.cartons) || 1) - 1) })} className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 text-xl font-bold">−</button>
                    <input
                      value={x.cartons} inputMode="numeric"
                      onChange={(e) => setItem(i, { cartons: e.target.value.replace(/\D/g, '') })}
                      className="w-16 h-11 text-center border border-slate-300 rounded-lg font-mono text-lg"
                    />
                    <button onClick={() => setItem(i, { cartons: (Number(x.cartons) || 0) + 1 })} className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 text-xl font-bold">+</button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('dlExpiry')}</div>
                  <ExpiryDateInput value={x.expiry} onChange={(v) => setItem(i, { expiry: v })} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setItems((xs) => [...xs, blankItem()])} className="text-teal-700 font-medium text-sm py-2">{t('dlAddProduct')}</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
          <input ref={galleryRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          {photo ? (
            <img src={photo.url} alt="" className="w-full rounded-xl border border-slate-200 max-h-80 object-contain bg-white" />
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl py-16 text-center text-slate-400 text-sm">{t('dlPhotoNeeded')}</div>
          )}
          <button onClick={() => fileRef.current?.click()} className={`${bigBtn} ${photo ? 'bg-white border border-slate-300 text-slate-700' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}>
            {photo ? t('dlRetake') : t('dlTakePhoto')}
          </button>
          {galleryOn && (
            <button onClick={() => galleryRef.current?.click()} className={`${bigBtn} bg-white border border-slate-300 text-slate-700`}>
              {t('dlGallery')}
            </button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {items.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{productById[x.productId]?.name}</span>
                <span className="font-mono text-slate-600 whitespace-nowrap">×{x.cartons} · {x.expiry.slice(8, 10)}/{x.expiry.slice(5, 7)}/{x.expiry.slice(2, 4)}</span>
              </div>
            ))}
          </div>
          {photo && <img src={photo.url} alt="" className="w-28 rounded-lg border border-slate-200" />}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {step > 0 && (
        <div className="flex gap-3 mt-5">
          <button onClick={() => { setError(''); setStep(step - 1) }} className="w-1/3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold py-4">{t('dlBack')}</button>
          {step === 1 && <button onClick={() => setStep(2)} disabled={!itemsOk} className={`flex-1 ${bigBtn} bg-teal-600 hover:bg-teal-700 text-white`}>{t('dlNext')}</button>}
          {step === 2 && <button onClick={() => setStep(3)} disabled={!photo} className={`flex-1 ${bigBtn} bg-teal-600 hover:bg-teal-700 text-white`}>{t('dlNext')}</button>}
          {step === 3 && <button onClick={confirm} disabled={saving} className={`flex-1 ${bigBtn} bg-teal-600 hover:bg-teal-700 text-white`}>{saving ? '…' : t('dlConfirm')}</button>}
        </div>
      )}

      {warn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="text-violet-700 text-lg font-semibold mb-3">⚠ {t('dlExtraWarnTitle')}</div>
            <div className="space-y-2 mb-4">
              {warn.map((w) => (
                <div key={w.product_id} className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
                  <div className="font-medium">{w.product} <span className="font-mono text-slate-600">×{w.cartons}</span></div>
                  <div className="text-xs text-violet-800 mt-0.5">
                    {w.kind === 'dihantar_lebih'
                      ? t('dlWarnMore', { o: w.owed, e: w.extra })
                      : t('dlWarnNotOrdered', { e: w.extra })}
                  </div>
                  {w.kind === 'no_order' && <div className="text-xs text-violet-600 mt-0.5">{t('dlNewOrder')}</div>}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setWarn(null)} className="w-1/3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold py-3.5">{t('dlGoBack')}</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold py-3.5">{saving ? '…' : t('dlContinue')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
