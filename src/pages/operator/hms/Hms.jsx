import { useEffect, useState } from 'react'
import { listHmsForms } from '../../../lib/api/hms'
import { Tabs } from '../../../components/ui'
import HmsToday from './HmsToday'
import HmsHistory from './HmsHistory'
import HmsHolidays from './HmsHolidays'

export default function Hms() {
  const [sub, setSub] = useState('today')
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listHmsForms().then((data) => { setForms(data); setLoading(false) })
  }, [])

  if (loading) return <div className="text-sm text-slate-400 p-6 text-center">…</div>

  return (
    <div>
      <Tabs
        active={sub} onChange={setSub}
        tabs={[
          { id: 'today', label: 'Today' },
          { id: 'history', label: 'History' },
          { id: 'holidays', label: 'Holidays' },
        ]}
      />
      {sub === 'today' && <HmsToday forms={forms} />}
      {sub === 'history' && <HmsHistory forms={forms} />}
      {sub === 'holidays' && <HmsHolidays />}
    </div>
  )
}
