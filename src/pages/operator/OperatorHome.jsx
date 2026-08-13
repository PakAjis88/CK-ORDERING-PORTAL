import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../lib/i18n'
import { listAllOrders } from '../../lib/api/orders'
import { listOutlets } from '../../lib/api/outlets'
import Header from '../../components/Header'
import { Tabs } from '../../components/ui'
import OrdersDashboard from './OrdersDashboard'
import StockTracker from './StockTracker'

export default function OperatorHome() {
  const { t } = useT()
  const now = new Date()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshOrders = useCallback(async () => setOrders(await listAllOrders()), [])

  useEffect(() => {
    Promise.all([listAllOrders(), listOutlets()]).then(([o, ou]) => {
      setOrders(o); setOutlets(ou); setLoading(false)
    })
  }, [])

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400 text-sm">…</div>

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs active={tab} onChange={setTab} tabs={[{ id: 'orders', label: t('tabOrdersFulfil') }, { id: 'stock', label: t('tabStockTracker') }]} />
        {tab === 'orders'
          ? <OrdersDashboard now={now} orders={orders} outlets={outlets} onChanged={refreshOrders} />
          : <StockTracker outlets={outlets} />}
      </main>
    </div>
  )
}
