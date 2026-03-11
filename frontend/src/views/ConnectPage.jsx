import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

export default function ConnectPage() {
  const { linkWithPartner, unlinkPartner, isLinked, partner } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLink() {
    if (!email.trim()) return
    setStatus(''); setLoading(true)
    try {
      await linkWithPartner(email.trim().toLowerCase())
      setSuccess(true)
      setStatus('🎉 Connected! Redirecting…')
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    if (!confirm('Are you sure you want to unlink from your partner?')) return
    await unlinkPartner()
  }

  const inp = {
    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 14px', color:C.text, fontSize:14,
    outline:'none', boxSizing:'border-box', fontFamily:'inherit',
    transition:'background 0.3s',
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif",padding:16,position:'relative',transition:'background 0.3s'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased} input::placeholder{color:${C.textDim}}`}</style>

      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position:'fixed', top:16, right:16, zIndex:10,
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:12, padding:'6px 12px', fontSize:16,
        cursor:'pointer', boxShadow:`0 2px 8px ${C.shadow}`,
      }}>
        {mode === 'light' ? '🌙' : '☀️'}
      </button>

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:'40px 34px',width:'100%',maxWidth:420,boxShadow:`0 8px 40px ${C.shadow}`,zIndex:1,transition:'background 0.3s, border-color 0.3s'}}>
        {/* Logo + back */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:26}}>
          <div>
            <div style={{fontFamily:"'Playfair Display'",fontSize:28,color:C.text}}>
              us<span style={{color:C.peach}}>.</span>cal
            </div>
            <div style={{fontSize:12,color:C.textDim,marginTop:2}}>connect with your partner 💕</div>
          </div>
          <button onClick={()=>navigate('/')} style={{background:'none',border:`1px solid ${C.border}`,color:C.textDim,borderRadius:10,padding:'5px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            ← Back
          </button>
        </div>

        {isLinked ? (
          <div>
            <div style={{background:C.mint+'18',border:`1px solid ${C.mint}44`,borderRadius:14,padding:'14px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:22}}>🌿</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.mint}}>Connected with {partner?.name}!</div>
                <div style={{fontSize:11,color:C.textMid,marginTop:2}}>Your calendars are synced.</div>
              </div>
            </div>
            <button onClick={()=>navigate('/')} style={{
              width:'100%',background:C.mint,color:'#fff',border:'none',
              borderRadius:12,padding:13,fontSize:14,fontWeight:700,cursor:'pointer',
              marginBottom:10,boxShadow:`0 4px 16px ${C.mint}44`,
            }}>
              ✦ Go to our calendar
            </button>
            <button onClick={handleUnlink} style={{
              width:'100%',background:'none',color:C.rose,
              border:`1px solid ${C.rose}44`,borderRadius:12,padding:11,
              fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
            }}>
              Unlink from {partner?.name}
            </button>
          </div>
        ) : (
          <div>
            <p style={{fontSize:13,color:C.textMid,lineHeight:1.7,marginBottom:18,marginTop:0}}>
              Enter your partner's email to link your calendars. They need to sign up first at the same URL.
            </p>

            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 16px',marginBottom:22,display:'flex',flexDirection:'column',gap:10}}>
              {[['🌸','You signed up ✓',true],['🌿',"Partner signs up at the same URL",false],["💕","Either of you enters the other's email below",false]].map(([icon,text,done],i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                  <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                  <span style={{fontWeight:done?700:400,color:done?C.mint:C.textMid}}>{text}</span>
                </div>
              ))}
            </div>

            <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6,fontWeight:700}}>
              Partner's email
            </label>
            <input
              type="email" placeholder="partner@email.com"
              value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLink()}
              style={{...inp, marginBottom:12}}
            />

            {status && (
              <p style={{fontSize:12,margin:'0 0 14px',lineHeight:1.6,
                color:success?C.mint:C.rose,
                background:success?C.mint+'18':C.rose+'18',
                border:`1px solid ${success?C.mint:C.rose}33`,
                borderRadius:8,padding:'8px 12px',
              }}>{status}</p>
            )}

            <button onClick={handleLink} disabled={loading||!email.trim()} style={{
              width:'100%',background:C.peach,color:'#fff',border:'none',
              borderRadius:12,padding:13,fontSize:14,fontWeight:700,
              cursor:(!email.trim()||loading)?'not-allowed':'pointer',
              opacity:(!email.trim()||loading)?0.5:1,transition:'all 0.2s',
              boxShadow:`0 4px 16px ${C.peach}44`,marginBottom:10,
            }}>
              {loading?'✿ Connecting…':'💕 Connect with partner'}
            </button>

            <button onClick={()=>navigate('/')} style={{
              width:'100%',background:'none',color:C.textDim,
              border:`1px solid ${C.border}`,borderRadius:12,padding:11,
              fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,
            }}>
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}