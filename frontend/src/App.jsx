import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage    from './views/LoginPage'
import ConnectPage  from './views/ConnectPage'
import CalendarPage from './views/CalendarPage'

function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth()
  if (isLoading) return <div style={{minHeight:'100vh',background:'#0F0F13',display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontFamily:'sans-serif',fontSize:13}}>loading…</div>
  if (!session)  return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/connect"  element={<ProtectedRoute><ConnectPage /></ProtectedRoute>} />
          <Route path="/*"        element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}