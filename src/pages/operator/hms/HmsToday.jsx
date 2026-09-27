import { useEffect, useState } from 'react'
import { listHmsHolidays, listHmsSubmissionsForDate, submitHmsForm, markHmsNil, updateHmsSubmission, reopenHmsSubmission } from '../../../lib/api/hms'
import { todayMYT, hmsStatus } from '../../../lib/hmsTime'
import HmsForm from './HmsForm'

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  on_time: { label: 'On time', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  missed: { label: 'Missed', cls: 'bg-red-50 text-red-700 border-red-200' },
  holiday: { label: 'Holiday', cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  weekend: { label: 'Weekend', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
}

export default function HmsToday({ forms }) {
  const [date, setDate] = useState(todayMYT())
  const [holidays, setHolidays] = useState(new Set())
  const [submissions, setSubmissions] = useState({}) // form_id -> submission
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // form being filled/edited
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    setLoading(true)
    Promise.all([listHmsHolidays(), listHmsSubmissionsForDate(date)]).then(([hols, subs]) => {
      setHolidays(new Set(hols.map((h) => h.date)))
      setSubmissions(Object.fromEntries((subs || []).map((s) => [s.form_id, s])))
      setLoading(false)
    })
  }
  useEffect(refresh, [date])

  const markNil = async (form) => {
    if (!confirm(`Mark "${form.name}" as no production for ${date}?`)) return
    await markHmsNil(form.id, date)
    refresh()
  }

  const undo = async (submission) => {
    if (!confirm('Reopen this record? It will need to be filled in again, and this resets its on-time/late status.')) return
    await reopenHmsSubmission(submission.id)
    refresh()
  }

  const save = async (payload) => {
    setSaving(true)
    try {
      const existing = submissions[editing.id]
      if (existing) await updateHmsSubmission(existing.id, payload)
      else await submitHmsForm(editing.id, date, payload)
      setEditing(null)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <label className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-400 text-xs">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent font-medium outline-none" />
        </label>
        {date !== todayMYT() && (
          <button onClick={() => setDate(todayMYT())} className="text-xs text-teal-700 hover:underline">Back to today</button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 p-6 text-center">…</div>
      ) : (
        <div className="space-y-2">
          {forms.map((form) => {
            const submission = submissions[form.id]
            const status = hmsStatus(submission, date, holidays)
            const meta = STATUS_META[status]
            return (
              <div key={form.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-sm">{form.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{form.code}</div>
                </div>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>{meta.label}</span>
                {submission?.status === 'nil' && <span className="text-xs text-slate-500">No production</span>}
                <div className="flex gap-2 shrink-0">
                  {!submission && (
                    <>
                      <button onClick={() => setEditing(form)} className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-md font-medium">Fill form</button>
                      <button onClick={() => markNil(form)} className="text-xs border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium">No production today</button>
                    </>
                  )}
                  {submission?.status === 'submitted' && (
                    <>
                      <button onClick={() => setEditing(form)} className="text-xs border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium">Edit</button>
                      <button onClick={() => undo(submission)} className="text-xs text-amber-700 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-md font-medium">Reopen</button>
                    </>
                  )}
                  {submission?.status === 'nil' && (
                    <button onClick={() => undo(submission)} className="text-xs text-amber-700 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-md font-medium">Undo</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold">{editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium">Close</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <HmsForm
                form={editing} submission={submissions[editing.id]} workDate={date}
                saving={saving} onSubmit={save} onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
