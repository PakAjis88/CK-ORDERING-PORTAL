import { useT } from '../lib/i18n'
import { STATUS_META } from '../lib/orderStatus'

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${active === tab.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Thumb() {
  return (
    <div className="w-11 h-11 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}

export function CatHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mt-5 mb-2 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</span>
      <span className="h-px bg-slate-200 flex-1" />
    </div>
  )
}

export function ReorderBadge() {
  const { t } = useT()
  return <span className="inline-block text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 font-medium align-middle ml-1">{t('reorderBadge')}</span>
}

export function StepBtn({ onClick, children }) {
  return <button type="button" onClick={onClick} className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">{children}</button>
}

export function Th({ children, right }) {
  return <th className={`px-4 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

export function Td({ children, right, mono }) {
  return <td className={`px-4 py-2.5 ${right ? 'text-right' : 'text-left'} ${mono ? 'font-mono' : ''}`}>{children}</td>
}

export function Badge({ st }) {
  const { t } = useT()
  const m = STATUS_META[st]
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${m.cls}`}>{t(m.key)}</span>
}

export function Stat({ label, value, mono, tone }) {
  const toneCls = { good: 'text-emerald-700', warn: 'text-amber-600', bad: 'text-red-600', info: 'text-indigo-600', muted: 'text-slate-400' }[tone] || 'text-slate-900'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${mono ? 'font-mono' : ''} ${toneCls}`}>{value}</div>
    </div>
  )
}

export function Select({ value, onChange, label, options }) {
  return (
    <label className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm">
      <span className="text-slate-400 text-xs">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

export function Empty({ children }) {
  return <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">{children}</div>
}
