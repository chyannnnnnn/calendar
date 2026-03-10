import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// This page handles two cases:
//   /connect        — logged-in user generates an invite link to share
//   /join/:code     — partner clicks the link and accepts the invite

export default function ConnectPage() {
  const { code } = useParams()         // present on /join/:code route
  const { createInviteLink, acceptInvite, isLinked } = useAuth()
  const navigate = useNavigate()

  const [link,    setLink]    = useState('')
  const [copied,  setCopied]  = useState(false)
  const [status,  setStatus]  = useState('')
  const [loading, setLoading] = useState(false)

  // If already linked, go home
  useEffect(() => { if (isLinked) navigate('/') }, [isLinked])

  // Auto-accept if we landed on /join/:code
  useEffect(() => {
    if (!code) return
    setLoading(true)
    acceptInvite(code)
      .then(() => { setStatus('🎉 Connected! Redirecting…'); setTimeout(() => navigate('/'), 1500) })
      .catch(err => { setStatus(`Error: ${err.message}`); setLoading(false) })
  }, [code])

  async function handleGenerate() {
    setLoading(true)
    try {
      const url = await createInviteLink()
      setLink(url)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const s = styles
  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet"/>
      <div style={s.card}>
        <div style={s.logo}>us<span style={{color:'#6EE7B7'}}>.</span>cal</div>

        {code ? (
          // Accepting flow
          <div>
            <p style={s.sub}>{loading ? 'Connecting you with your partner…' : status}</p>
          </div>
        ) : (
          // Generating flow
          <div>
            <p style={s.sub}>Share an invite link with your partner to connect your calendars.</p>
            {!link ? (
              <button onClick={handleGenerate} disabled={loading} style={s.btn}>
                {loading ? '…' : 'Generate invite link'}
              </button>
            ) : (
              <div>
                <div style={s.linkBox}>{link}</div>
                <button onClick={handleCopy} style={{...s.btn, background: copied ? '#1A1A20' : '#6EE7B7', color: copied ? '#6EE7B7' : '#0F0F13'}}>
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
                <p style={{fontSize:11,color:'#444',marginTop:10,textAlign:'center'}}>Link expires in 7 days</p>
              </div>
            )}
            {status && <p style={s.error}>{status}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', background:'#0F0F13', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" },
  card: { background:'#13131A', border:'1px solid #1E1E28', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:380 },
  logo: { fontFamily:"'Playfair Display'", fontSize:28, color:'#F0EDE8', marginBottom:8 },
  sub:  { fontSize:13, color:'#777', lineHeight:1.6, marginBottom:20 },
  btn:  { width:'100%', background:'#6EE7B7', color:'#0F0F13', border:'none', borderRadius:10, padding:12, fontSize:14, fontWeight:600, cursor:'pointer', transition:'all 0.2s' },
  linkBox: { background:'#1A1A20', border:'1px solid #2A2A35', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#888', wordBreak:'break-all', marginBottom:10 },
  error: { fontSize:12, color:'#FCA5A5', marginTop:10, textAlign:'center' },
}