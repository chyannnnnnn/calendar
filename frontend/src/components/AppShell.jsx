import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useState, useEffect } from 'react'

// Main nav — no Profile here, that lives in the bottom user section
const NAV_ITEMS = [
  { path:'/',       label:'Calendar', icon:'🗓' },
  { path:'/diary',  label:'Diary',    icon:'📖' },
  { path:'/board',  label:'Board',    icon:'🪵' },
  { path:'/bucket', label:'Bucket',   icon:'🪣' },
]

// Hidden on these paths
const HIDE_ON = ['/login', '/connect']

export default function AppShell({ children }) {
  const { C, mode, toggle: toggleTheme } = useTheme()
  const { user, partner, isLinked, signOut, unlinkPartner } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return children

  const isActive = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(path)

  const isProfileActive = location.pathname.startsWith('/profile')

  // ── Avatar or initials ─────────────────────────────────────────────────────
  function Avatar({ src, name, size, color, border }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden', border: `2px solid ${border || color + '55'}`,
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4,
      }}>
        {src
          ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          : <span>{name?.[0]?.toUpperCase() || '?'}</span>
        }
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // MOBILE — bottom tab bar
  // ════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:C.bg, overflow:'hidden' }}>

        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {children}
        </div>

        {/* Bottom tab bar */}
        <nav style={{
          flexShrink: 0, background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}>
          {/* Main nav tabs */}
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path)
            return (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 0 6px', position: 'relative',
              }}>
                {active && (
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 24, height: 2, borderRadius: 2, background: C.peach,
                  }}/>
                )}
                <span style={{
                  fontSize: 20, lineHeight: 1,
                  filter: active ? 'none' : 'opacity(0.55)',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.15s',
                }}>{item.icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: active ? 800 : 500,
                  color: active ? C.peach : C.textDim,
                  fontFamily: "'Nunito',sans-serif",
                  letterSpacing: '0.02em',
                }}>{item.label}</span>
              </button>
            )
          })}

          {/* Profile tab — shows avatar, at the end */}
          <button onClick={() => navigate('/profile?view=mine')} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 0 6px', position: 'relative',
          }}>
            {isProfileActive && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 2, borderRadius: 2, background: C.peach,
              }}/>
            )}
            <Avatar
              src={user?.avatarUrl} name={user?.name}
              size={24} color={C.mint}
              border={isProfileActive ? C.peach : C.border}
            />
            <span style={{
              fontSize: 9, fontWeight: isProfileActive ? 800 : 500,
              color: isProfileActive ? C.peach : C.textDim,
              fontFamily: "'Nunito',sans-serif",
              letterSpacing: '0.02em',
            }}>Me</span>
          </button>
        </nav>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // DESKTOP — left sidebar
  // ════════════════════════════════════════════════════════════════
  const SW = sidebarOpen ? 210 : 56

  return (
    <div style={{ height:'100dvh', display:'flex', background:C.bg, overflow:'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: SW, flexShrink: 0, height: '100%',
        display: 'flex', flexDirection: 'column',
        background: C.surface, borderRight: `1px solid ${C.border}`,
        transition: 'width 0.2s ease', overflow: 'hidden', zIndex: 20,
      }}>

        {/* Logo row */}
        <div style={{
          height: 52, flexShrink: 0, display: 'flex', alignItems: 'center',
          padding: sidebarOpen ? '0 12px 0 16px' : '0',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: `1px solid ${C.border}`,
        }}>
          {sidebarOpen && (
            <div style={{ fontFamily:"'Playfair Display'", fontSize:17, color:C.text, whiteSpace:'nowrap' }}>
              us<span style={{color:C.peach}}>.</span>cal
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background:'none', border:'none', cursor:'pointer',
            color:C.textDim, fontSize:13, padding:6, borderRadius:8,
            display:'flex', alignItems:'center', justifyContent:'center',
          }} title={sidebarOpen ? 'Collapse' : 'Expand'}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* ── Main nav ── */}
        <div style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path)
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                title={!sidebarOpen ? item.label : undefined}
                style={{
                  display:'flex', alignItems:'center',
                  gap: sidebarOpen ? 10 : 0,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  padding: sidebarOpen ? '9px 12px' : '9px 0',
                  background: active ? C.peach+'18' : 'none',
                  border: `1.5px solid ${active ? C.peach+'44' : 'transparent'}`,
                  borderRadius:11, cursor:'pointer', width:'100%',
                  transition:'all 0.15s', whiteSpace:'nowrap',
                  color: active ? C.peach : C.textMid,
                  fontFamily:"'Nunito',sans-serif",
                }}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=C.bg+'cc' }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='none' }}
              >
                <span style={{fontSize:17, flexShrink:0, lineHeight:1}}>{item.icon}</span>
                {sidebarOpen && <span style={{fontSize:13, fontWeight:active?800:600}}>{item.label}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Bottom user section ── */}
        <div style={{ padding:'8px', borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:4 }}>

          {/* Dark / Light mode toggle */}
          <button onClick={toggleTheme}
            title={!sidebarOpen ? (mode==='light'?'Dark mode':'Light mode') : undefined}
            style={{
              display:'flex', alignItems:'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: sidebarOpen ? 10 : 0,
              background:'none', border:`1px solid ${C.border}`,
              borderRadius:10, padding: sidebarOpen ? '7px 12px' : '7px 0',
              cursor:'pointer', width:'100%', color:C.textMid,
              fontFamily:"'Nunito',sans-serif", transition:'all 0.15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=C.bg}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >
            <span style={{fontSize:14}}>{mode==='light'?'🌙':'☀️'}</span>
            {sidebarOpen && <span style={{fontSize:12, fontWeight:600}}>{mode==='light'?'Dark':'Light'}</span>}
          </button>

          {/* Partner row — only when linked */}
          {isLinked && partner && (
            <button onClick={() => navigate('/profile?view=partner')}
              title={!sidebarOpen ? (partner.name+' (partner)') : undefined}
              style={{
                display:'flex', alignItems:'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: sidebarOpen ? 10 : 0,
                background: C.rose+'10', border:`1px solid ${C.rose}33`,
                borderRadius:10, padding: sidebarOpen ? '7px 10px' : '7px 0',
                cursor:'pointer', width:'100%',
                fontFamily:"'Nunito',sans-serif", transition:'all 0.15s',
              }}
              onMouseEnter={e=>e.currentTarget.style.background=C.rose+'1e'}
              onMouseLeave={e=>e.currentTarget.style.background=C.rose+'10'}
            >
              <Avatar src={partner.avatarUrl} name={partner.name} size={22} color={C.rose}/>
              {sidebarOpen && (
                <div style={{minWidth:0, flex:1}}>
                  <div style={{fontSize:11, fontWeight:700, color:C.rose, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{partner.name}</div>
                  <div style={{fontSize:9, color:C.textDim}}>Partner ✦</div>
                </div>
              )}
            </button>
          )}

          {/* User / Profile row — with popup menu for sign out */}
          <div style={{position:'relative'}}>
            <button onClick={() => setUserMenuOpen(o=>!o)}
              title={!sidebarOpen ? (user?.name||'Profile') : undefined}
              style={{
                display:'flex', alignItems:'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: sidebarOpen ? 10 : 0,
                background: (isProfileActive||userMenuOpen) ? C.peach+'18' : 'none',
                border:`1.5px solid ${(isProfileActive||userMenuOpen) ? C.peach+'55' : 'transparent'}`,
                borderRadius:10, padding: sidebarOpen ? '7px 10px' : '7px 0',
                cursor:'pointer', width:'100%',
                fontFamily:"'Nunito',sans-serif", transition:'all 0.15s',
              }}
              onMouseEnter={e=>{ if(!isProfileActive&&!userMenuOpen) e.currentTarget.style.background=C.bg }}
              onMouseLeave={e=>{ if(!isProfileActive&&!userMenuOpen) e.currentTarget.style.background='none' }}
            >
              <Avatar src={user?.avatarUrl} name={user?.name} size={24} color={C.mint}
                border={(isProfileActive||userMenuOpen) ? C.peach : undefined}
              />
              {sidebarOpen && (
                <>
                  <div style={{minWidth:0, flex:1, textAlign:'left'}}>
                    <div style={{fontSize:12, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user?.name||'You'}</div>
                    <div style={{fontSize:9, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user?.email||''}</div>
                  </div>
                  <span style={{fontSize:10, color:C.textDim, flexShrink:0}}>{userMenuOpen?'▼':'▲'}</span>
                </>
              )}
            </button>

            {/* User popup menu — floats above */}
            {userMenuOpen && (
              <>
                <div onClick={()=>setUserMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:99}}/>
                <div style={{
                  position:'absolute', bottom:'calc(100% + 6px)',
                  left:0, right:0, zIndex:100,
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:14, overflow:'hidden',
                  boxShadow:`0 -8px 32px rgba(0,0,0,0.2)`,
                }}>
                  <button onClick={()=>{navigate('/profile?view=mine');setUserMenuOpen(false)}} style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10,
                    background:'none', border:'none', padding:'11px 14px',
                    cursor:'pointer', fontSize:13, color:C.text,
                    fontFamily:"'Nunito',sans-serif", fontWeight:600, textAlign:'left',
                    transition:'background 0.1s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:15}}>🌿</span> My Profile
                  </button>
                  {isLinked && (
                    <button onClick={async()=>{if(confirm('Disconnect from '+partner?.name+'?'))await unlinkPartner();setUserMenuOpen(false)}} style={{
                      width:'100%', display:'flex', alignItems:'center', gap:10,
                      background:'none', border:'none', padding:'11px 14px',
                      cursor:'pointer', fontSize:13, color:C.rose,
                      fontFamily:"'Nunito',sans-serif", fontWeight:600, textAlign:'left',
                      borderTop:`1px solid ${C.border}`,
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.rose+'12'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    >
                      <span style={{fontSize:15}}>💔</span> Disconnect
                    </button>
                  )}
                  <button onClick={()=>{signOut();setUserMenuOpen(false)}} style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10,
                    background:'none', border:'none', padding:'11px 14px',
                    cursor:'pointer', fontSize:13, color:C.textMid,
                    fontFamily:"'Nunito',sans-serif", fontWeight:600, textAlign:'left',
                    borderTop:`1px solid ${C.border}`,
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:15}}>🚪</span> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0}}>
        {children}
      </div>
    </div>
  )
}