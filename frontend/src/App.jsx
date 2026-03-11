import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider, useTheme } from './lib/ThemeContext'
import LoginPage    from './views/LoginPage'
import ConnectPage  from './views/ConnectPage'
import CalendarPage from './views/CalendarPage'
import ProfilePage  from './views/ProfilePage'

function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth()
  const { C } = useTheme()
  if (isLoading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textDim,fontFamily:"'Nunito',sans-serif",fontSize:13}}>
      ✿ loading…
    </div>
  )
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"   element={<LoginPage />} />
            <Route path="/connect" element={<ProtectedRoute><ConnectPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/*"       element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}