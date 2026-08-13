import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { receiptText } from '../../lib/receipt'

export default function Confirmation({ order, onNew }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const text = receiptText(order)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { setCopied(false) }
  }
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl">✓</div>
        <h2 className="font-semibold mt-2">{t('orderPlaced')}</h2>
        <p className="text-sm text-slate-500">{t('copyIntro')}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-dashed border-slate-300 px-5 py-3 text-center text-xs tracking-widest text-slate-400 font-mono">{t('slipTitle')}</div>
        <pre className="px-5 py-4 text-sm font-mono whitespace-pre-wrap text-slate-800 leading-relaxed">{text}</pre>
        <div className="border-t border-dashed border-slate-300 p-3">
          <button onClick={copy} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition">
            {copied ? t('copied') : t('copyWa')}
          </button>
        </div>
      </div>
      <button onClick={onNew} className="w-full mt-3 text-sm text-teal-700 hover:underline">{t('placeAnother')}</button>
    </div>
  )
}
