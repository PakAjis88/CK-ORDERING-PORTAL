import { useState } from 'react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { t, lang, setLang } = useT()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch {
      setError(t('loginError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-md bg-teal-500 flex items-center justify-center font-bold font-mono text-white">CK</div>
          <div>
            <div className="font-semibold leading-tight">CK Products</div>
            <div className="text-xs text-slate-500 leading-tight">{t('brandSub')}</div>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'ms' ? 'en' : 'ms')}
            className="ml-3 px-2.5 py-1 rounded-md border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white"
          >
            {lang === 'ms' ? 'ENG' : 'BM'}
          </button>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h1 className="font-semibold text-lg mb-4">{t('loginTitle')}</h1>
          <label className="block text-xs text-slate-500 mb-1">{t('loginEmail')}</label>
          <input
            type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <label className="block text-xs text-slate-500 mb-1">{t('loginPassword')}</label>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            {busy ? '…' : t('loginSubmit')}
          </button>
        </form>
      </div>
    </div>
  )
}
