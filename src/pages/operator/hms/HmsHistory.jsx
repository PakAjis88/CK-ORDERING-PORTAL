import { useEffect, useMemo, useState } from 'react'
import { listHmsSubmissions, listHmsHolidays } from '../../../lib/api/hms'
import { hmsStatus, todayMYT } from '../../../lib/hmsTime'
import { Select } from '../../../components/ui'

const DOT_CLS = {
  pending: 'bg-slate-200',
  on_time: 'bg-emerald-500',
  late: 'bg-amber-500',
  missed: 'bg-red-500',
  holiday: 'bg-indigo-300',
  weekend: 'bg-slate-100',
}

const monthOptions = () => {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return [key, d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })]
  })
}

export default function HmsHistory({ forms }) {
  const [month, setMonth] = useState(todayMYT().slice(0, 7))
  const [submissions, setSubmissions] = useState([])
  const [holidays, setHolidays] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([listHmsSubmissions(month), listHmsHolidays()]).then(([subs, hols]) => {
      setSubmissions(subs)
      setHolidays(new Set(hols.map((h) => h.date)))
      setLoading(false)
    })
  }, [month])

  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  }, [month])

  const findSubmission = (formId, day) => submissions.find((s) => s.form_id === formId && s.work_date === day)

  const totals = useMemo(() => {
    let onTime = 0, late = 0, missed = 0, counted = 0
    forms.forEach((form) => {
      days.forEach((day) => {
        const status = hmsStatus(findSubmission(form.id, day), day, holidays)
        if (status === 'on_time') { onTime++; counted++ }
        else if (status === 'late') { late++; counted++ }
        else if (status === 'missed') { missed++; counted++ }
      })
    })
    return { onTime, late, missed, pct: counted ? Math.round((onTime / counted) * 100) : 0 }
  }, [forms, days, submissions, holidays])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={month} onChange={setMonth} label="Month" options={monthOptions()} />
        <div className="ml-auto flex gap-4 text-xs text-slate-500">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />On time {totals.onTime}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" />Late {totals.late}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />Missed {totals.missed}</span>
          <span className="font-semibold text-slate-700">{totals.pct}% on time</span>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 p-6 text-center">…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500 text-xs">Form</th>
                {days.map((day) => (
                  <th key={day} className="px-1 py-2 text-center font-medium text-slate-400 text-xs">{Number(day.slice(-2))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white px-3 py-2 whitespace-nowrap text-xs font-medium">{form.name}</td>
                  {days.map((day) => {
                    const status = hmsStatus(findSubmission(form.id, day), day, holidays)
                    return (
                      <td key={day} className="px-1 py-2 text-center" title={status}>
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT_CLS[status]}`} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
