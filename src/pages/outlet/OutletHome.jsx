import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../lib/i18n'
import { listProducts } from '../../lib/api/products'
import { listMyOrders, placeOrder, editOrder, cancelOrder } from '../../lib/api/orders'
import Header from '../../components/Header'
import { Tabs } from '../../components/ui'
import OrderForm from './OrderForm'
import Confirmation from './Confirmation'
import MyOrders from './MyOrders'
import StockReport from './StockReport'

export default function OutletHome() {
  const { t } = useT()
  const now = new Date()
  const [tab, setTab] = useState('order')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const refreshOrders = useCallback(async () => setOrders(await listMyOrders()), [])

  useEffect(() => {
    Promise.all([listProducts(), listMyOrders()]).then(([p, o]) => {
      setProducts(p); setOrders(o); setLoading(false)
    })
  }, [])

  const changeTab = (id) => { setTab(id); setConfirmed(null); setEditTarget(null) }

  const handleSubmit = async (lines, isReorder) => {
    const order = await placeOrder(lines, isReorder)
    await refreshOrders()
    setConfirmed(order)
  }
  const handleUpdate = async (orderId, lines) => {
    const order = await editOrder(orderId, lines)
    await refreshOrders()
    setConfirmed(order)
    setEditTarget(null)
  }
  const startEdit = (o) => { setEditTarget(o); setConfirmed(null); setTab('order') }
  const handleCancel = async (o) => { await cancelOrder(o.id); await refreshOrders() }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400 text-sm">…</div>

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs
          active={tab} onChange={changeTab}
          tabs={[{ id: 'order', label: t('tabNewOrder') }, { id: 'history', label: t('tabMyOrders') }, { id: 'stock', label: t('tabStock') }]}
        />
        {tab === 'order' && (confirmed
          ? <Confirmation order={confirmed} onNew={() => setConfirmed(null)} />
          : <OrderForm
              products={products} orders={orders} editOrder={editTarget}
              onSubmit={handleSubmit} onUpdate={handleUpdate}
              onCancelEdit={() => { setEditTarget(null); setTab('history') }}
            />)}
        {tab === 'history' && <MyOrders now={now} orders={orders} onEdit={startEdit} onCancel={handleCancel} />}
        {tab === 'stock' && <StockReport products={products} />}
      </main>
    </div>
  )
}
