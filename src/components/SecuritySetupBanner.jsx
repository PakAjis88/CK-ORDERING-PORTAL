import { useState } from 'react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { setSecurityAnswer } from '../lib/api/auth'

// Shown when the signed-in user hasn't set up account recovery yet. No
// outbound email is configured for this project, so "forgot password" relies
// on this security question instead — dismissible per session, reappears
// next login until it's actually set up (profile.security_question is the
// persistent signal, not anything stored client-side).
export default function SecuritySetupBanner() {
  const { t } = useT()
  const { refreshProfile } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (dismissed) return null

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await setSecurityAnswer(question.trim(), answer.trim())
      await refreshProfile()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl px-4 py-3 mb-4 text-sm border bg-indigo-50 border-indigo-200 text-indigo-800">
      {!open ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span>{t('setupRecoveryPrompt')}</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setOpen(true)} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium">
              {t('setupRecoveryNow')}
            </button>
            <button onClick={() => setDismissed(true)} className="text-xs border border-indigo-300 hover:bg-indigo-100 px-3 py-1.5 rounded-md font-medium">
              {t('notNow')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('securityQuestionPlaceholder')}
            className="w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm"
          />
          <input
            value={answer} onChange={(e) => setAnswer(e.target.value)}
            placeholder={t('securityAnswerPlaceholder')}
            className="w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="text-xs border border-slate-300 hover:bg-white px-3 py-1.5 rounded-md font-medium">
              {t('cancel')}
            </button>
            <button
              onClick={save} disabled={saving || !question.trim() || !answer.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium"
            >
              {saving ? '…' : t('saveChanges')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
