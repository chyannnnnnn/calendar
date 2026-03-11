import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

const DOODLES = [
  { id:'h',  x:'7%',  y:'15%', size:20, rot:'-15deg', dur:'7s',  del:'0s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14 14 21 12 21Z" fill="#D4607A22" stroke="#D4607A55" strokeWidth="1.5"/></svg> },
  { id:'s',  x:'88%', y:'9%',  size:16, rot:'20deg',  dur:'9s',  del:'1s',
    svg:<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#D4920A22" stroke="#D4920A55" strokeWidth="1"/></svg> },
  { id:'m',  x:'4%',  y:'60%', size:22, rot:'10deg',  dur:'11s', del:'2s',
    svg:<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="#8B72BE22" stroke="#8B72BE44" strokeWidth="1.5"/></svg> },
  { id:'f',  x:'90%', y:'55%', size:24, rot:'-20deg', dur:'8s',  del:'0.5s',
    svg:<svg viewBox="0 0 32 32"><circle cx="16" cy="10" r="4" fill="#E8787022"/><circle cx="22" cy="14" r="4" fill="#E8787022"/><circle cx="22" cy="21" r="4" fill="#E8787022"/><circle cx="16" cy="25" r="4" fill="#E8787022"/><circle cx="10" cy="21" r="4" fill="#E8787022"/><circle cx="10" cy="14" r="4" fill="#E8787022"/><circle cx="16" cy="17" r="5" fill="#D4920A33"/></svg> },
  { id:'sp', x:'50%', y:'4%',  size:18, rot:'0deg',   dur:'6s',  del:'1.5s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#4BAF8444" strokeWidth="2" strokeLinecap="round"/></svg> },
  { id:'c',  x:'18%', y:'83%', size:28, rot:'-5deg',  dur:'13s', del:'4s',
    svg:<svg viewBox="0 0 40 24"><path d="M32 20H10C6.13 20 3 16.87 3 13s3.13-7 7-7c.34 0 .67.03 1 .07C12.29 3.93 15.39 2 19 2c4.97 0 9 4.03 9 9h1c2.76 0 5 2.24 5 5s-2.24 5-5 5z" fill="#8B72BE18" stroke="#8B72BE33" strokeWidth="1"/></svg> },
  { id:'h2', x:'75%', y:'78%', size:14, rot:'12deg',  dur:'10s', del:'3s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14 14 21 12 21Z" fill="#D4607A18" stroke="#D4607A33" strokeWidth="1"/></svg> },
]

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [pageMode, setPageMode] = useState('signin')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit() {
    setError(''); setLoading(true)
    try {
      if (pageMode === 'signup') {
        const { error } = await signUp(email, password, name)
        if (error) throw error
        setError('Check your email to confirm your account, then sign in.')
        setPageMode('signin')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 14px', color:C.text, fontSize:14,
    outline:'none', marginBottom:4, boxSizing:'border-box', fontFamily:'inherit',
  }
  const isConfirm = error.startsWith('Check your email')

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif",padding:16,position:'relative',overflow:'hidden',transition:'background 0.3s'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0) rotate(var(--rot))}50%{transform:translateY(-10px) rotate(calc(var(--rot) + 4deg))}}
        @keyframes pulse-soft{0%,100%{opacity:0.6}50%{opacity:0.9}}
        .doodle{animation:float var(--dur) ease-in-out var(--del) infinite,pulse-soft calc(var(--dur)*1.4) ease-in-out infinite}
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
      `}</style>

      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position:'fixed', top:16, right:16, zIndex:10,
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:12, padding:'6px 12px', fontSize:16,
        cursor:'pointer', boxShadow:`0 2px 8px ${C.shadow}`,
        transition:'all 0.2s',
      }}>
        {mode === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Floating doodles */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none'}}>
        {DOODLES.map(d=>(
          <div key={d.id} className="doodle" style={{position:'absolute',left:d.x,top:d.y,width:d.size,height:d.size,'--rot':d.rot,'--dur':d.dur,'--del':d.del}}>
            {d.svg}
          </div>
        ))}
      </div>

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:'40px 34px',width:'100%',maxWidth:380,boxShadow:`0 8px 40px ${C.shadow}`,position:'relative',zIndex:1,transition:'background 0.3s, border-color 0.3s'}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:26}}>
          <div style={{fontFamily:"'Playfair Display'",fontSize:34,color:C.text,letterSpacing:'-0.5px'}}>
            us<span style={{color:C.peach}}>.</span>cal
          </div>
          <p style={{fontSize:13,color:C.textDim,marginTop:5,marginBottom:0}}>your shared calendar 🌸</p>
        </div>

        {/* Mode toggle */}
        <div style={{display:'flex',background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:3,marginBottom:22,gap:3}}>
          {[['signin','Sign in'],['signup','Sign up']].map(([m,label])=>(
            <button key={m} onClick={()=>setPageMode(m)} style={{
              flex:1, border:'none', borderRadius:11, padding:'8px 0', fontSize:13,
              fontWeight:pageMode===m?700:500,
              background:pageMode===m?C.peach:'transparent',
              color:pageMode===m?'#fff':C.textDim,
              cursor:'pointer', transition:'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {pageMode==='signup' && <>
          <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Your name</label>
          <input placeholder="e.g. Mei" value={name} onChange={e=>setName(e.target.value)} style={{...inp,marginBottom:14}}/>
        </>}

        <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Email</label>
        <input placeholder="you@email.com" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{...inp,marginBottom:14}}/>

        <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Password</label>
        <input placeholder="••••••••" type="password" value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={{...inp,marginBottom:16}}/>

        {error && (
          <p style={{fontSize:12,color:isConfirm?C.mint:C.rose,margin:'0 0 14px',lineHeight:1.6,
            background:isConfirm?C.mint+'18':C.rose+'18',
            border:`1px solid ${isConfirm?C.mint:C.rose}33`,
            borderRadius:8,padding:'8px 12px',
          }}>{error}</p>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width:'100%',background:pageMode==='signup'?C.mint:C.peach,
          color:'#fff',border:'none',borderRadius:12,padding:14,
          fontSize:15,fontWeight:700,cursor:'pointer',
          opacity:loading?0.7:1,transition:'all 0.2s',
          boxShadow:`0 4px 16px ${pageMode==='signup'?C.mint:C.peach}44`,
        }}>
          {loading?'✿ Loading…':pageMode==='signin'?'✿ Sign in':'✿ Create account'}
        </button>

        <p style={{textAlign:'center',fontSize:11,color:C.textDim,marginTop:20,marginBottom:0}}>
          a cozy space just for you two 🌿
        </p>
      </div>
    </div>
  )
}