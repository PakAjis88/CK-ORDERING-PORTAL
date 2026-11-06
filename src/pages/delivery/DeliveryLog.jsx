import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import ExpiryDateInput, { isValidExpiry } from '../../components/ExpiryDateInput'
import { fmtDate } from '../../lib/format'
import { listDeliveries, correctDeliveryEntry, signedPhotoUrl } from '../../lib/api/deliveries'
import { groupEntries, KIND_LABEL } from '../../lib/deliveryLog'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// The team's delivery entries for a date range. Entries the database allows the
// signed-in user to change (can_correct) get a Correct button; the rest are locked.
// onChanged runs after a correction (the operator tab uses it to refresh orders).
export default function DeliveryLog({ from, to, outletId, onChanged }) {
  const { t } = useT()
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // { entry, cartons, expiry }
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [photo, setPhoto] = useState(null) // signed url

  const latest = useRef(0)
  const load = useCallback(async () => {
    const mine = ++latest.current // ignore an older response that arrives after a newer request
    setError('')
    try {
      const rows = groupEntries(await listDeliveries(from, to, outletId))
      if (mine === latest.current) setEntries(rows)
    } catch (e) {
      if (mine === latest.current) { setEntries([]); setError(e.message) }
    }
  }, [from, to, outletId])

  useEffect(() => { load() }, [load])

  const save = async (cartons) => {
    setSaving(true); setEditError('')
    try {
      await correctDeliveryEntry({ dropId: editing.entry.dropId, productId: editing.entry.productId, cartons, expiry: editing.expiry })
      setEditing(null)
      await load()
      onChanged?.()
    } catch (e) {
      setEditError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const viewPhoto = async (path) => {
    try { setPhoto(await signedPhotoUrl(path)) } catch (e) { setError(e.message) }
  }

  if (entries === null) return <div className="text-sm text-slate-400 py-6 text-center">…</div>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {entries.length === 0 && !error && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">{t('dlNoRows')}</div>
      )}
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.key} className="bg-white border border-slate-200 rounded-xl p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{e.productName}</div>
                <div className="text-xs text-slate-500 mt-0.5">{e.outletCode} · {e.outletName}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">×{e.cartons}</div>
                <div className="font-mono text-[11px] text-slate-400">{fmtDate(e.deliveredDate)}</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {t('dlExpiry')} {fmtDate(e.expiry)} · {t('dlBy', { n: e.enteredBy })}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {e.parts.map((p, i) => (
                <div key={i} className={`text-xs ${p.kind === 'normal' ? 'text-emerald-700' : 'text-violet-700 font-semibold'}`}>
                  {p.kind === 'normal' ? '✓' : '★'} {p.cartons} → {p.orderNo}{p.kind !== 'normal' ? ` · ${KIND_LABEL[p.kind]}` : ''}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2.5">
              {e.photoPath && <button onClick={() => viewPhoto(e.photoPath)} className="text-xs text-teal-700 hover:underline">{t('dlViewPhoto')}</button>}
              <span className="flex-1" />
              {e.canCorrect
                ? <button onClick={() => { setEditing({ entry: e, cartons: String(e.cartons), expiry: e.expiry || '' }); setEditError('') }} className="text-sm border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium">{t('dlCorrect')}</button>
                : <span className="text-xs text-slate-400">🔒 {t('dlLocked')}</span>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="font-semibold">{editing.entry.productName}</h3>
            <p className="text-xs text-slate-500 mb-4">{editing.entry.outletCode} · {editing.entry.outletName} · {fmtDate(editing.entry.deliveredDate)}</p>
            <div className="flex items-end gap-4 mb-4">
              <label className="block">
                <span className="text-xs text-slate-500">{t('dlCartons')}</span>
                <input
                  value={editing.cartons} inputMode="numeric"
                  onChange={(ev) => setEditing({ ...editing, cartons: ev.target.value.replace(/\D/g, '') })}
                  className="block mt-1 w-20 border border-slate-300 rounded-lg py-2.5 px-3 text-center font-mono text-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">{t('dlExpiry')}</span>
                <div className="mt-1"><ExpiryDateInput value={editing.expiry} onChange={(v) => setEditing({ ...editing, expiry: v })} /></div>
              </label>
            </div>
            {editError && <p className="text-xs text-red-600 mb-3">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t('cancel')}</button>
              <button
                onClick={() => save(Number(editing.cartons))}
                disabled={saving || !(Number(editing.cartons) > 0) || !ISO.test(editing.expiry) || !isValidExpiry(editing.expiry)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg"
              >
                {saving ? '…' : t('dlSaveChange')}
              </button>
            </div>
            <button
              onClick={() => { if (window.confirm(t('dlRemoveSure'))) save(0) }} disabled={saving}
              className="w-full text-center text-xs text-red-600 hover:underline mt-3"
            >
              {t('dlRemoveEntry')}
            </button>
          </div>
        </div>
      )}

      {photo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70" onClick={() => setPhoto(null)}>
          <img src={photo} alt="" className="max-h-[90vh] max-w-full rounded-xl bg-white" />
        </div>
      )}
    </div>
  )
}
