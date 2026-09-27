import { useEffect, useState } from 'react'
import { listHmsHolidays, upsertHmsHoliday, deleteHmsHoliday } from '../../../lib/api/hms'

export default function HmsHolidays() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = () => listHmsHolidays().then((data) => { setHolidays(data); setLoading(false) })
  useEffect(refresh, [])

  const add = async () => {
    if (!date) return
    setSaving(true)
    try {
      await upsertHmsHoliday(date, name || null)
      setDate(''); setName('')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d) => {
    if (!confirm(`Remove ${d} from holidays?`)) return
    await deleteHmsHoliday(d)
    refresh()
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="block border border-slate-300 rounded-md py-1.5 px-2 text-sm mt-1" />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs text-slate-500">Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hari Raya" className="block w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm mt-1" />
        </label>
        <button onClick={add} disabled={saving || !date} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {saving ? '…' : 'Add holiday'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 p-6 text-center">…</div>
      ) : holidays.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">No holidays added yet.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {holidays.map((h) => (
            <div key={h.date} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-mono">{h.date}</span>
                {h.name && <span className="text-sm text-slate-500 ml-3">{h.name}</span>}
              </div>
              <button onClick={() => remove(h.date)} className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-md font-medium">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
