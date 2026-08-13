import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import OutletHome from './pages/outlet/OutletHome'
import OperatorHome from './pages/operator/OperatorHome'

function FullScreenSpinner() {
  return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>
}

function ProtectedRoute({ role, children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenSpinner />
  if (role === 'outlet' && profile.role !== 'outlet') return <Navigate to="/operator" replace />
  if (role === 'operator' && profile.role === 'outlet') return <Navigate to="/outlet" replace />
  return children
}

function RootRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenSpinner />
  return <Navigate to={profile.role === 'outlet' ? '/outlet' : '/operator'} replace />
}

export default function App() {
  const { session, profile, loading } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? <FullScreenSpinner /> :
          session && profile ? <Navigate to={profile.role === 'outlet' ? '/outlet' : '/operator'} replace /> :
          <Login />
        }
      />
      <Route path="/outlet" element={<ProtectedRoute role="outlet"><OutletHome /></ProtectedRoute>} />
      <Route path="/operator" element={<ProtectedRoute role="operator"><OperatorHome /></ProtectedRoute>} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
