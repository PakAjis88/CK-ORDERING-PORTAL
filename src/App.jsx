import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import OutletHome from './pages/outlet/OutletHome'
import OperatorHome from './pages/operator/OperatorHome'
import DeliveryHome from './pages/delivery/DeliveryHome'

function FullScreenSpinner() {
  return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>
}

// Each login type has one home page; delivery staff never see the operator pages.
const homeFor = (role) => (role === 'outlet' ? '/outlet' : role === 'delivery' ? '/delivery' : '/operator')

function ProtectedRoute({ role, children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenSpinner />
  const home = homeFor(profile.role)
  if (home !== `/${role}`) return <Navigate to={home} replace />
  return children
}

function RootRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenSpinner />
  return <Navigate to={homeFor(profile.role)} replace />
}

export default function App() {
  const { session, profile, loading } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? <FullScreenSpinner /> :
          session && profile ? <Navigate to={homeFor(profile.role)} replace /> :
          <Login />
        }
      />
      <Route path="/outlet" element={<ProtectedRoute role="outlet"><OutletHome /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute role="delivery"><DeliveryHome /></ProtectedRoute>} />
      <Route path="/operator" element={<ProtectedRoute role="operator"><OperatorHome /></ProtectedRoute>} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
