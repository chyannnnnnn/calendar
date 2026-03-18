import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { path:'/',        label:'Calendar', icon:'🗓',  activeIcon:'🗓'  },
  { path:'/diary',   label:'Diary',    icon:'📖',  activeIcon:'📖'  },
  { path:'/board',   label:'Board',    icon:'🪵',  activeIcon:'🪵'  },
  { path:'/bucket',  label:'Bucket',   icon:'🪣',  activeIcon:'🪣'  },
  { path:'/profile', label:'Profile',  icon:'🌿',  activeIcon:'🌿'  },
]

export default function AppShell({ children }) {
  const { C, mode, toggle: toggleTheme } = useTheme()
  const { user, partner, isLinked } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Don't show shell on login / connect pages
  const hidden = ['/login', '/connect'].some(p => location.pathname.startsWith(p))
  if (hidden) return children

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const active = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(path)

  // ── Mobile: bottom tab bar ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: C.bg, overflow: 'hidden',
      }}>
        {/* Page content — leaves room for tab bar */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>

        {/* Bottom tab bar */}
        <div style={{
          flexShrink: 0,
          height: 60,
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}>
          {NAV_ITEMS.map(item => {
            const isActive = active(item.path)
            const isProfile = item.path === '/profile'
            return (
              <button
                key={item.path}
                onClick={() => navigate(isProfile ? '/profile?view=mine' : item.path)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 0 2px',
                  position: 'relative',
                }}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: C.peach,
                  }}/>
                )}
                {/* Avatar for profile tab */}
                {isProfile && user?.avatarUrl
                  ? <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      overflow: 'hidden', border: `2px solid ${isActive ? C.peach : C.border}`,
                      transition: 'border-color 0.15s', flexShrink: 0,
                    }}>
                      <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  : <span style={{
                      fontSize: 20,
                      filter: isActive ? 'none' : 'grayscale(30%) opacity(0.7)',
                      transition: 'all 0.15s',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      display: 'block',
                    }}>{item.icon}</span>
                }
                <span style={{
                  fontSize: 9, fontWeight: isActive ? 800 : 500,
                  color: isActive ? C.peach : C.textDim,
                  fontFamily: "'Nunito', sans-serif",
                  transition: 'color 0.15s',
                  letterSpacing: '0.02em',
                }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Desktop: left sidebar ───────────────────────────────────────────────────
  const SW = sidebarOpen ? 200 : 64  // sidebar width

  return (
    <div style={{
      height: '100dvh', display: 'flex',
      background: C.bg, overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        width: SW, flexShrink: 0,
        height: '100%', display: 'flex', flexDirection: 'column',
        background: C.surface, borderRight: `1px solid ${C.border}`,
        transition: 'width 0.2s ease',
        overflow: 'hidden', zIndex: 20,
      }}>
        {/* Logo + collapse */}
        <div style={{
          height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
          padding: sidebarOpen ? '0 14px 0 16px' : '0 0 0 0',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: `1px solid ${C.border}`,
        }}>
          {sidebarOpen && (
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 17, color: C.text, whiteSpace: 'nowrap' }}>
              us<span style={{ color: C.peach }}>.</span>cal
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textDim, fontSize: 16, padding: 6, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s',
          }}
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >{sidebarOpen ? '◀' : '▶'}</button>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = active(item.path)
            const isProfile = item.path === '/profile'
            return (
              <button
                key={item.path}
                onClick={() => navigate(isProfile ? '/profile?view=mine' : item.path)}
                title={!sidebarOpen ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: sidebarOpen ? 10 : 0,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  padding: sidebarOpen ? '10px 12px' : '10px 0',
                  background: isActive ? C.peach + '18' : 'none',
                  border: `1.5px solid ${isActive ? C.peach + '55' : 'transparent'}`,
                  borderRadius: 12, cursor: 'pointer', width: '100%',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                  color: isActive ? C.peach : C.textMid,
                  fontFamily: "'Nunito', sans-serif",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bg }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
              >
                {isProfile && user?.avatarUrl
                  ? <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      overflow: 'hidden', border: `2px solid ${isActive ? C.peach : C.border}`,
                    }}>
                      <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  : <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                }
                {sidebarOpen && (
                  <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600 }}>{item.label}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom: theme + partner pill */}
        <div style={{ padding: '8px 8px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Partner pill — only when open */}
          {sidebarOpen && isLinked && partner && (
            <button onClick={() => navigate('/profile?view=partner')} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: C.rose + '12', border: `1px solid ${C.rose}33`,
              borderRadius: 10, padding: '7px 10px', cursor: 'pointer',
              width: '100%', fontFamily: "'Nunito', sans-serif",
            }}>
              {partner.avatarUrl
                ? <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${C.rose}66` }}>
                    <img src={partner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                : <span style={{ fontSize: 14, flexShrink: 0 }}>🌷</span>
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.rose, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>Partner</div>
              </div>
            </button>
          )}

          {/* Theme toggle */}
          <button onClick={toggleTheme} style={{
            display: 'flex', alignItems: 'center',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            gap: sidebarOpen ? 8 : 0,
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: sidebarOpen ? '7px 10px' : '7px 0',
            cursor: 'pointer', width: '100%', color: C.textMid,
            fontFamily: "'Nunito', sans-serif",
          }}>
            <span style={{ fontSize: 14 }}>{mode === 'light' ? '🌙' : '☀️'}</span>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 600 }}>{mode === 'light' ? 'Dark mode' : 'Light mode'}</span>}
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}