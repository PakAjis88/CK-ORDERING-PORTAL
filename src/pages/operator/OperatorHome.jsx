import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../lib/i18n'
import { listAllOrders } from '../../lib/api/orders'
import { listOutlets } from '../../lib/api/outlets'
import { listProducts } from '../../lib/api/products'
import Header from '../../components/Header'
import { Tabs } from '../../components/ui'
import OrdersDashboard from './OrdersDashboard'
import StockTracker from './StockTracker'
import Catalogue from './Catalogue'
import Production from './Production'

export default function OperatorHome() {
  const { t } = useT()
  const now = new Date()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [outlets, setOutlets] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshOrders = useCallback(async () => setOrders(await listAllOrders()), [])
  const refreshProducts = useCallback(async () => setProducts(await listProducts()), [])

  useEffect(() => {
    Promise.all([listAllOrders(), listOutlets(), listProducts()]).then(([o, ou, p]) => {
      setOrders(o); setOutlets(ou); setProducts(p); setLoading(false)
    })
  }, [])

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400 text-sm">…</div>

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs
          active={tab} onChange={setTab}
          tabs={[
            { id: 'orders', label: t('tabOrdersFulfil') },
            { id: 'stock', label: t('tabStockTracker') },
            { id: 'catalogue', label: t('tabCatalogue') },
            { id: 'production', label: t('tabProduction') },
          ]}
        />
        {tab === 'orders' && <OrdersDashboard now={now} orders={orders} outlets={outlets} onChanged={refreshOrders} />}
        {tab === 'stock' && <StockTracker outlets={outlets} />}
        {tab === 'catalogue' && <Catalogue products={products} onChanged={refreshProducts} />}
        {tab === 'production' && <Production orders={orders} />}
      </main>
    </div>
  )
}
