import { useT } from '../../lib/i18n'

const inputCls = 'border border-slate-300 rounded-lg py-2.5 px-3 text-sm bg-white font-mono'

// value: { from, to, outletId }
export default function DeliveryFilters({ value, onChange, outlets }) {
  const { t } = useT()
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <label className="block">
        <span className="text-xs text-slate-500">{t('dlFrom')}</span>
        <input type="date" value={value.from} max={value.to} onChange={(e) => set({ from: e.target.value })} className={`${inputCls} block mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{t('dlTo')}</span>
        <input type="date" value={value.to} min={value.from} onChange={(e) => set({ to: e.target.value })} className={`${inputCls} block mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{t('outlet')}</span>
        <select value={value.outletId} onChange={(e) => set({ outletId: e.target.value })} className={`${inputCls} block mt-1 font-sans`}>
          <option value="">{t('dlAllOutlets')}</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.code} {o.name}</option>)}
        </select>
      </label>
    </div>
  )
}
