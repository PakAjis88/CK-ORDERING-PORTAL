import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { listOutlets } from '../../lib/api/outlets'
import { listProducts } from '../../lib/api/products'
import { klToday, klWeekStart, getGalleryEnabled } from '../../lib/api/deliveries'
import Header from '../../components/Header'
import NewDelivery from './NewDelivery'
import DeliveryLog from './DeliveryLog'
import DeliveryFilters from './DeliveryFilters'
import ReportButtons from './ReportButtons'

// Delivery staff: three big tabs, nothing else.
export default function DeliveryHome() {
  const { t } = useT()
  const [tab, setTab] = useState('new')
  const [outlets, setOutlets] = useState([])
  const [products, setProducts] = useState([])
  const [galleryOn, setGalleryOn] = useState(false)
  const [loading, setLoading] = useState(true)
  const today = klToday()
  const [filters, setFilters] = useState({ from: `${today.slice(0, 8)}01`, to: today, outletId: '' })

  useEffect(() => {
    // if the gallery switch cannot be read, play safe: camera only
    Promise.all([listOutlets(), listProducts(), getGalleryEnabled().catch(() => false)]).then(([o, p, g]) => { setOutlets(o); setProducts(p); setGalleryOn(g); setLoading(false) })
  }, [])

  const tabs = [['new', t('dlTabNew')], ['week', t('dlTabWeek')], ['report', t('dlTabReport')]]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-xl mx-auto px-4 py-5">
        <div className="grid grid-cols-3 gap-2 mb-5">
          {tabs.map(([id, label]) => (
            <button
              key={id} onClick={() => setTab(id)}
              className={`rounded-xl py-3 text-sm font-semibold ${tab === id ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-10">…</div>
        ) : (
          <>
            {tab === 'new' && <NewDelivery outlets={outlets} products={products} galleryEnabled={galleryOn} />}
            {tab === 'week' && (
              <div>
                <p className="text-xs text-slate-500 mb-3">{t('dlWeekHint')}</p>
                <DeliveryLog from={klWeekStart()} to={today} />
              </div>
            )}
            {tab === 'report' && (
              <div>
                <p className="text-xs text-slate-500 mb-3">{t('dlReportHint')}</p>
                <DeliveryFilters value={filters} onChange={setFilters} outlets={outlets} />
                <ReportButtons filters={filters} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
