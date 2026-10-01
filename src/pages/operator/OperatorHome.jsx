import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../lib/i18n'
import { useAuth } from '../../lib/AuthContext'
import { listAllOrders } from '../../lib/api/orders'
import { listOutlets } from '../../lib/api/outlets'
import { listProducts } from '../../lib/api/products'
import { listRawMaterials, listProductRecipes } from '../../lib/api/materials'
import Header from '../../components/Header'
import { Tabs } from '../../components/ui'
import OrdersDashboard from './OrdersDashboard'
import StockTracker from './StockTracker'
import Catalogue from './Catalogue'
import Production from './Production'
import Hms from './hms/Hms'

export default function OperatorHome() {
  const { t } = useT()
  const { profile } = useAuth()
  const now = new Date()
  const [tab, setTab] = useState(profile.role === 'halal' ? 'hms' : 'orders')
  const [orders, setOrders] = useState([])
  const [outlets, setOutlets] = useState([])
  const [products, setProducts] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshOrders = useCallback(async () => setOrders(await listAllOrders()), [])
  const refreshProducts = useCallback(async () => setProducts(await listProducts()), [])
  const refreshMaterials = useCallback(async () => {
    const [m, r] = await Promise.all([listRawMaterials(), listProductRecipes()])
    setRawMaterials(m); setRecipes(r)
  }, [])

  useEffect(() => {
    Promise.all([listAllOrders(), listOutlets(), listProducts(), listRawMaterials(), listProductRecipes()]).then(([o, ou, p, m, r]) => {
      setOrders(o); setOutlets(ou); setProducts(p); setRawMaterials(m); setRecipes(r); setLoading(false)
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
            { id: 'hms', label: 'HMS' },
          ]}
        />
        {tab === 'orders' && <OrdersDashboard now={now} orders={orders} outlets={outlets} onChanged={refreshOrders} />}
        {tab === 'stock' && <StockTracker outlets={outlets} products={products} />}
        {tab === 'catalogue' && <Catalogue products={products} rawMaterials={rawMaterials} onChanged={refreshProducts} onMaterialsChanged={refreshMaterials} />}
        {tab === 'production' && <Production orders={orders} recipes={recipes} rawMaterials={rawMaterials} />}
        {tab === 'hms' && <Hms />}
      </main>
    </div>
  )
}
