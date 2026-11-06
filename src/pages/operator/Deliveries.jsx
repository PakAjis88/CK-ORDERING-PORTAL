import { useState } from 'react'
import { klToday, klWeekStart } from '../../lib/api/deliveries'
import DeliveryFilters from '../delivery/DeliveryFilters'
import DeliveryLog from '../delivery/DeliveryLog'
import ReportButtons from '../delivery/ReportButtons'

// Operator / admin / HMS view of the delivery staff's entries: any date range,
// corrections allowed at any time (the database lets operators change old weeks).
export default function Deliveries({ outlets, onChanged }) {
  const today = klToday()
  const [filters, setFilters] = useState({ from: klWeekStart(today), to: today, outletId: '' })
  return (
    <div className="max-w-3xl">
      <DeliveryFilters value={filters} onChange={setFilters} outlets={outlets} />
      <div className="mb-5"><ReportButtons filters={filters} /></div>
      <DeliveryLog from={filters.from} to={filters.to} outletId={filters.outletId} onChanged={onChanged} />
    </div>
  )
}
