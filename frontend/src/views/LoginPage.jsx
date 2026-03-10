import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode,     setMode]     = useState('signin')   // 'signin' | 'signup'
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit() {
    setError(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, name)
        if (error) throw error
        // Supabase sends a confirmation email — tell the user
        setError('Check your email to confirm your account, then sign in.')
        setMode('signin')
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

  const s = styles
  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet"/>
      <div style={s.card}>
        <div style={s.logo}>us<span style={{color:'#6EE7B7'}}>.</span>cal</div>
        <p style={s.tagline}>your shared calendar, always in sync</p>

        <div style={s.toggle}>
          {['signin','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              ...s.toggleBtn,
              background: mode===m ? '#2A2A35' : 'transparent',
              color:      mode===m ? '#F0EDE8' : '#555',
            }}>{m === 'signin' ? 'Sign in' : 'Sign up'}</button>
          ))}
        </div>

        {mode === 'signup' && (
          <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
            style={s.input} />
        )}
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          style={s.input} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={s.input} />

        {error && <p style={s.error}>{error}</p>}

        <button onClick={handleSubmit} disabled={loading} style={s.btn}>
          {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', background:'#0F0F13', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" },
  card: { background:'#13131A', border:'1px solid #1E1E28', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:360 },
  logo: { fontFamily:"'Playfair Display'", fontSize:28, color:'#F0EDE8', marginBottom:6 },
  tagline: { fontSize:13, color:'#555', marginBottom:24, marginTop:0 },
  toggle: { display:'flex', background:'#1A1A20', borderRadius:20, padding:3, marginBottom:20 },
  toggleBtn: { flex:1, border:'none', borderRadius:17, padding:'7px 0', fontSize:13, cursor:'pointer', transition:'all 0.15s' },
  input: { width:'100%', background:'#1A1A20', border:'1px solid #2A2A35', borderRadius:8, padding:'10px 12px', color:'#F0EDE8', fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box', colorScheme:'dark' },
  btn: { width:'100%', background:'#6EE7B7', color:'#0F0F13', border:'none', borderRadius:10, padding:13, fontSize:15, fontWeight:600, cursor:'pointer', marginTop:6 },
  error: { fontSize:12, color:'#FCA5A5', margin:'0 0 10px', lineHeight:1.5 },
}