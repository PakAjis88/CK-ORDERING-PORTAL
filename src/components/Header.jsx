import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'

export default function Header() {
  const { lang, setLang, t } = useT()
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center font-bold font-mono">CK</div>
          <div>
            <div className="font-semibold leading-tight">CK Products</div>
            <div className="text-xs text-slate-400 leading-tight">{t('brandSub')}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {profile && (
            <span className="text-xs text-slate-300 hidden sm:inline">
              {t('signedInAs')} <span className="font-medium text-white">{profile.outlet?.name || profile.full_name || 'Operator'}</span>
            </span>
          )}
          <button
            onClick={() => setLang(lang === 'ms' ? 'en' : 'ms')}
            title="Language"
            className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            {lang === 'ms' ? 'ENG' : 'BM'}
          </button>
          {profile && (
            <button
              onClick={signOut}
              className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              {t('signOut')}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
