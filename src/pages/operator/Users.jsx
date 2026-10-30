import { useState } from 'react'
import { createUser } from '../../lib/api/users'

const blank = { email: '', password: '', outletCode: '', outletName: '', fullName: '', role: 'operator' }
const inputCls = 'w-full mt-1 border border-slate-300 rounded-md py-1.5 px-2 text-sm'

export default function Users({ onAdded }) {
  const [kind, setKind] = useState('outlet')
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const switchKind = (k) => { setKind(k); setError(''); setDone('') }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setDone('')
    try {
      const fields = kind === 'outlet'
        ? { email: form.email, password: form.password, outletCode: form.outletCode, outletName: form.outletName }
        : { email: form.email, password: form.password, fullName: form.fullName, role: form.role }
      const res = await createUser(kind, fields)
      setDone(kind === 'outlet'
        ? `Added ${res.outlet.code} ${res.outlet.name}. Login: ${res.email}`
        : `Added ${res.role} login: ${res.email}`)
      setForm(blank)
      await onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <div className="flex gap-2 mb-4">
        {[['outlet', 'New outlet'], ['staff', 'Staff']].map(([k, label]) => (
          <button
            key={k} type="button" onClick={() => switchKind(k)}
            className={`text-sm px-4 py-2 rounded-lg font-medium border ${kind === k ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        {kind === 'outlet' ? (
          <>
            <label className="block">
              <span className="text-xs text-slate-500">Outlet code (e.g. MBG035)</span>
              <input value={form.outletCode} onChange={(e) => setField('outletCode', e.target.value)} className={`${inputCls} font-mono uppercase`} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Outlet name</span>
              <input value={form.outletName} onChange={(e) => setField('outletName', e.target.value)} className={inputCls} />
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-xs text-slate-500">Name</span>
              <input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Role</span>
              <select value={form.role} onChange={(e) => setField('role', e.target.value)} className={`${inputCls} bg-white`}>
                <option value="operator">Operator (full access)</option>
                <option value="halal">Halal (HMS)</option>
              </select>
            </label>
          </>
        )}
        <label className="block">
          <span className="text-xs text-slate-500">Login email</span>
          <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">First password (min 6 characters). Tell them privately; they can recover it later with the security question.</span>
          <input value={form.password} onChange={(e) => setField('password', e.target.value)} autoComplete="off" className={`${inputCls} font-mono`} />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {done && <p className="text-xs text-emerald-700 font-medium">{done}</p>}

        <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
          {saving ? '…' : 'Add user'}
        </button>
      </form>
    </div>
  )
}
