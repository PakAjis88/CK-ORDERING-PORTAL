import { useState } from 'react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { getSecurityQuestion, resetPasswordWithAnswer } from '../lib/api/auth'

function RecoverFlow({ onBack }) {
  const { t } = useT()
  const [step, setStep] = useState('email') // 'email' | 'answer' | 'done'
  const [email, setEmail] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submitEmail = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const q = await getSecurityQuestion(email.trim())
      if (!q) { setError(t('noRecoverySetUp')); return }
      setQuestion(q)
      setStep('answer')
    } catch {
      setError(t('loginError'))
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      await resetPasswordWithAnswer(email.trim(), answer.trim(), newPassword)
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-emerald-700 mb-4">{t('recoverSuccess')}</p>
        <button onClick={onBack} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg transition">
          {t('backToLogin')}
        </button>
      </div>
    )
  }

  if (step === 'answer') {
    return (
      <form onSubmit={submitAnswer} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h1 className="font-semibold text-lg mb-1">{t('recoverAnswerTitle')}</h1>
        <p className="text-sm text-slate-600 mb-4">{question}</p>
        <label className="block text-xs text-slate-500 mb-1">{t('securityAnswer')}</label>
        <input
          required autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="block text-xs text-slate-500 mb-1">{t('newPassword')}</label>
        <input
          type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="block text-xs text-slate-500 mb-1">{t('confirmPassword')}</label>
        <input
          type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition mb-2">
          {busy ? '…' : t('recoverSubmit')}
        </button>
        <button type="button" onClick={onBack} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1.5">
          {t('backToLogin')}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submitEmail} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h1 className="font-semibold text-lg mb-1">{t('recoverEmailTitle')}</h1>
      <p className="text-sm text-slate-600 mb-4">{t('recoverEmailHint')}</p>
      <label className="block text-xs text-slate-500 mb-1">{t('loginEmail')}</label>
      <input
        type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
      />
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <button type="submit" disabled={busy} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition mb-2">
        {busy ? '…' : t('recoverContinue')}
      </button>
      <button type="button" onClick={onBack} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1.5">
        {t('backToLogin')}
      </button>
    </form>
  )
}

export default function Login() {
  const { t, lang, setLang } = useT()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)

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
        {recovering ? (
          <RecoverFlow onBack={() => setRecovering(false)} />
        ) : (
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
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition mb-2"
            >
              {busy ? '…' : t('loginSubmit')}
            </button>
            <button type="button" onClick={() => setRecovering(true)} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1.5">
              {t('forgotPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
