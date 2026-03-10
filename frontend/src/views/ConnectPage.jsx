import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ConnectPage() {
  const { linkWithPartner, unlinkPartner, isLinked, partner } = useAuth()
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

  const s = styles
  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet"/>
      <div style={s.card}>
        <div style={s.logo}>us<span style={{color:'#6EE7B7'}}>.</span>cal</div>

        {isLinked ? (
          <div>
            <div style={{display:'inline-block', background:'#6EE7B722', color:'#6EE7B7', borderRadius:20, padding:'4px 12px', fontSize:12, marginBottom:16}}>
              ● Connected with {partner?.name}
            </div>
            <p style={s.sub}>Your calendars are synced.</p>
            <button onClick={() => navigate('/')} style={s.btn}>Go to calendar</button>
            <button onClick={handleUnlink} style={{...s.btn, background:'transparent', color:'#FCA5A5', marginTop:8, border:'1px solid #FCA5A533'}}>
              Unlink from {partner?.name}
            </button>
          </div>
        ) : (
          <div>
            <p style={s.sub}>
              Enter your partner's email to connect your calendars. They need to sign up first.
            </p>

            <div style={s.steps}>
              <div style={s.step}><span style={s.num}>1</span> You sign up ✓</div>
              <div style={s.step}><span style={s.num}>2</span> Partner signs up at the same URL</div>
              <div style={s.step}><span style={s.num}>3</span> Either of you enters the other's email below</div>
            </div>

            <label style={s.label}>Partner's email</label>
            <input
              type="email"
              placeholder="partner@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLink()}
              style={s.input}
            />

            {status && <p style={{fontSize:12, margin:'0 0 12px', lineHeight:1.5, color: success ? '#6EE7B7' : '#FCA5A5'}}>{status}</p>}

            <button onClick={handleLink} disabled={loading || !email.trim()} style={{
              ...s.btn,
              opacity: (!email.trim() || loading) ? 0.5 : 1,
              cursor:  (!email.trim() || loading) ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Connecting…' : 'Connect with partner'}
            </button>

            <button onClick={() => navigate('/')} style={{...s.btn, background:'transparent', color:'#444', marginTop:8}}>
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page:  { minHeight:'100vh', background:'#0F0F13', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:16 },
  card:  { background:'#13131A', border:'1px solid #1E1E28', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:400 },
  logo:  { fontFamily:"'Playfair Display'", fontSize:28, color:'#F0EDE8', marginBottom:8 },
  sub:   { fontSize:13, color:'#777', lineHeight:1.7, marginBottom:20, marginTop:0 },
  label: { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 },
  input: { width:'100%', background:'#1A1A20', border:'1px solid #2A2A35', borderRadius:8, padding:'11px 12px', color:'#F0EDE8', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:12, colorScheme:'dark' },
  btn:   { width:'100%', background:'#6EE7B7', color:'#0F0F13', border:'none', borderRadius:10, padding:12, fontSize:14, fontWeight:600, cursor:'pointer', display:'block', transition:'all 0.2s', boxSizing:'border-box' },
  steps: { background:'#1A1A20', borderRadius:10, padding:'12px 14px', marginBottom:20, display:'flex', flexDirection:'column', gap:8 },
  step:  { fontSize:12, color:'#666', display:'flex', alignItems:'center', gap:10 },
  num:   { background:'#2A2A35', color:'#888', borderRadius:'50%', width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 },
}