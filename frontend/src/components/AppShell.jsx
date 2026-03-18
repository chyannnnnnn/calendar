import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useState, useEffect } from 'react'

// Main nav — no Profile here, that lives in the bottom user section
const NAV_ITEMS = [
  { path:'/',        label:'Calendar', icon:'🗓' },
  { path:'/diary',   label:'Diary',    icon:'📖' },
  { path:'/board',   label:'Board',    icon:'🪵' },
  { path:'/bucket',  label:'Bucket',   icon:'🪣' },
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

          {/* Profile + Partner stacked tab */}
          <button onClick={() => navigate(isProfileActive ? '/partner' : '/profile')} style={{
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
            {/* Stacked couple avatars */}
            <div style={{position:'relative', width:28, height:24}}>
              <Avatar src={user?.avatarUrl} name={user?.name} size={22} color={C.mint}
                border={isProfileActive ? C.peach : C.border}
              />
              {isLinked && partner && (
                <div style={{position:'absolute', bottom:-2, right:-6}}>
                  <Avatar src={partner.avatarUrl} name={partner.name} size={16} color={C.rose}/>
                </div>
              )}
            </div>
            <span style={{
              fontSize: 9, fontWeight: isProfileActive ? 800 : 500,
              color: isProfileActive ? C.peach : C.textDim,
              fontFamily: "'Nunito',sans-serif",
              letterSpacing: '0.02em',
            }}>Us</span>
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

        {/* ── Bottom: couple card + controls ── */}
        <div style={{ padding:'8px', borderTop:`1px solid ${C.border}` }}>

          {/* Couple card — You ✦ Partner */}
          <div style={{
            background:`linear-gradient(135deg,${C.mint}14,${C.rose}14)`,
            border:`1px solid ${C.border}`,
            borderRadius:14, padding: sidebarOpen ? '10px 12px' : '8px 0',
            marginBottom:6, position:'relative',
            display:'flex', alignItems:'center',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
          }}>
            {sidebarOpen ? (
              /* Expanded: You ✦ Partner side by side */
              <div style={{display:'flex', alignItems:'center', gap:0, width:'100%'}}>
                {/* You */}
                <button onClick={()=>navigate('/profile')} style={{
                  flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  background:'none', border:'none', cursor:'pointer', borderRadius:10, padding:'4px 6px',
                  transition:'background 0.15s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.mint+'18'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}
                >
                  <Avatar src={user?.avatarUrl} name={user?.name} size={32} color={C.mint}
                    border={isProfileActive ? C.peach : undefined}
                  />
                  <span style={{fontSize:10, fontWeight:700, color:C.mint, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {user?.name?.split(' ')[0] || 'You'}
                  </span>
                </button>

                {/* Divider ✦ */}
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0, padding:'0 4px'}}>
                  <div style={{width:1, height:14, background:C.border}}/>
                  <span style={{fontSize:10, color:C.textDim, fontWeight:800}}>✦</span>
                  <div style={{width:1, height:14, background:C.border}}/>
                </div>

                {/* Partner */}
                {isLinked && partner ? (
                  <button onClick={()=>navigate('/partner')} style={{
                    flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    background:'none', border:'none', cursor:'pointer', borderRadius:10, padding:'4px 6px',
                    transition:'background 0.15s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.rose+'18'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <Avatar src={partner.avatarUrl} name={partner.name} size={32} color={C.rose}/>
                    <span style={{fontSize:10, fontWeight:700, color:C.rose, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {partner.name?.split(' ')[0] || 'Partner'}
                    </span>
                  </button>
                ) : (
                  <button onClick={()=>navigate('/connect')} style={{
                    flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    background:'none', border:'none', cursor:'pointer', borderRadius:10, padding:'4px 6px',
                  }}>
                    <div style={{width:32,height:32,borderRadius:'50%',border:`2px dashed ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:C.textDim}}>＋</div>
                    <span style={{fontSize:10, fontWeight:600, color:C.textDim}}>Connect</span>
                  </button>
                )}
              </div>
            ) : (
              /* Collapsed: stacked avatars */
              <button onClick={()=>navigate('/profile')} title={user?.name} style={{
                background:'none', border:'none', cursor:'pointer', position:'relative', padding:0,
              }}>
                <Avatar src={user?.avatarUrl} name={user?.name} size={28} color={C.mint}/>
                {isLinked && partner && (
                  <div style={{position:'absolute', bottom:-4, right:-4}}>
                    <Avatar src={partner.avatarUrl} name={partner.name} size={18} color={C.rose}/>
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Controls row: theme toggle + ··· menu */}
          <div style={{display:'flex', gap:4}}>
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={mode==='light'?'Dark mode':'Light mode'}
              style={{
                flex: sidebarOpen ? 1 : 1,
                display:'flex', alignItems:'center', justifyContent:'center',
                gap: sidebarOpen ? 6 : 0,
                background:'none', border:`1px solid ${C.border}`,
                borderRadius:10, padding:'7px 8px',
                cursor:'pointer', color:C.textMid,
                fontFamily:"'Nunito',sans-serif", transition:'background 0.15s',
                whiteSpace:'nowrap', overflow:'hidden',
              }}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
            >
              <span style={{fontSize:13}}>{mode==='light'?'🌙':'☀️'}</span>
              {sidebarOpen && <span style={{fontSize:11,fontWeight:600}}>{mode==='light'?'Dark':'Light'}</span>}
            </button>

            {/* ··· More menu (sign out, disconnect) */}
            <div style={{position:'relative', flexShrink:0}}>
              <button onClick={()=>setUserMenuOpen(o=>!o)} title="More options"
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: userMenuOpen ? C.bg : 'none', border:`1px solid ${userMenuOpen ? C.borderHi : C.border}`,
                  borderRadius:10, padding:'7px 10px',
                  cursor:'pointer', color:C.textMid, fontSize:14,
                  transition:'all 0.15s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                onMouseLeave={e=>{ if(!userMenuOpen) e.currentTarget.style.background='none' }}
              >···</button>

              {userMenuOpen && (
                <>
                  <div onClick={()=>setUserMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:99}}/>
                  <div style={{
                    position:'absolute', bottom:'calc(100% + 6px)', right:0, zIndex:100,
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:14, overflow:'hidden', minWidth:160,
                    boxShadow:`0 -8px 32px rgba(0,0,0,0.18)`,
                  }}>
                    <button onClick={()=>{navigate('/profile');setUserMenuOpen(false)}} style={{
                      width:'100%',display:'flex',alignItems:'center',gap:8,
                      background:'none',border:'none',padding:'10px 14px',
                      cursor:'pointer',fontSize:12,color:C.text,
                      fontFamily:"'Nunito',sans-serif",fontWeight:600,textAlign:'left',
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    ><span>🌿</span> My Profile</button>
                    {isLinked && (
                      <button onClick={async()=>{if(confirm('Disconnect from '+partner?.name+'?')){await unlinkPartner()}setUserMenuOpen(false)}} style={{
                        width:'100%',display:'flex',alignItems:'center',gap:8,
                        background:'none',border:'none',padding:'10px 14px',
                        cursor:'pointer',fontSize:12,color:C.rose,
                        fontFamily:"'Nunito',sans-serif",fontWeight:600,textAlign:'left',
                        borderTop:`1px solid ${C.border}`,
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.rose+'12'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}
                      ><span>💔</span> Disconnect</button>
                    )}
                    <button onClick={()=>{signOut();setUserMenuOpen(false)}} style={{
                      width:'100%',display:'flex',alignItems:'center',gap:8,
                      background:'none',border:'none',padding:'10px 14px',
                      cursor:'pointer',fontSize:12,color:C.textMid,
                      fontFamily:"'Nunito',sans-serif",fontWeight:600,textAlign:'left',
                      borderTop:`1px solid ${C.border}`,
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    ><span>🚪</span> Sign out</button>
                  </div>
                </>
              )}
            </div>
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