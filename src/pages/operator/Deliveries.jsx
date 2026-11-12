import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { klToday, klWeekStart, getGalleryEnabled, setGalleryEnabled } from '../../lib/api/deliveries'
import DeliveryFilters from '../delivery/DeliveryFilters'
import DeliveryLog from '../delivery/DeliveryLog'
import ReportButtons from '../delivery/ReportButtons'

// Operator / admin / HMS view of the delivery staff's entries: any date range,
// corrections allowed at any time (the database lets operators change old weeks).
export default function Deliveries({ outlets, onChanged }) {
  const { profile } = useAuth()
  const canSwitch = profile.role === 'operator' || profile.role === 'admin' // HMS logins only see the state
  const today = klToday()
  const [filters, setFilters] = useState({ from: klWeekStart(today), to: today, outletId: '' })
  const [gallery, setGallery] = useState(null) // null = still loading
  const [switchError, setSwitchError] = useState('')

  useEffect(() => { getGalleryEnabled().then(setGallery).catch(() => setGallery(null)) }, [])

  const toggleGallery = async () => {
    const next = !gallery
    const question = next
      ? 'Enable "Choose from gallery" for all delivery staff?'
      : 'Disable "Choose from gallery" for all delivery staff? They can then only take a photo with the camera.'
    if (!window.confirm(question)) return
    setSwitchError('')
    try {
      await setGalleryEnabled(next)
      setGallery(next)
    } catch (e) {
      setSwitchError(e.message)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Delivery staff: choose photo from gallery</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {gallery === null ? '…' : gallery ? 'On: staff can take a photo or pick one from the gallery.' : 'Off: staff can only take a photo with the camera.'}
          </div>
          {switchError && <div className="text-xs text-red-600 mt-1">{switchError}</div>}
        </div>
        {canSwitch && gallery !== null && (
          <button onClick={toggleGallery} className={`text-sm font-medium px-4 py-2 rounded-lg border ${gallery ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}`}>
            {gallery ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
      <DeliveryFilters value={filters} onChange={setFilters} outlets={outlets} />
      <div className="mb-5"><ReportButtons filters={filters} /></div>
      <DeliveryLog from={filters.from} to={filters.to} outletId={filters.outletId} onChanged={onChanged} />
    </div>
  )
}
