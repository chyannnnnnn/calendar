import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const FIELD_DEFS = [
  { key:'bio',              label:'About',                  emoji:'🌸' },
  { key:'mbti',             label:'MBTI',                   emoji:'🧠' },
  { key:'loveLanguage',     label:'Love language',          emoji:'💕' },
  { key:'birthday',         label:'Birthday',               emoji:'🎂' },
  { key:'favouriteFood',    label:'Favourite food',         emoji:'🍜' },
  { key:'favouriteCafe',    label:'Favourite café',         emoji:'☕' },
  { key:'hobbies',          label:'Hobbies',                emoji:'🎨' },
  { key:'currentObsession', label:'Currently obsessed with',emoji:'✨' },
  { key:'petPeeve',         label:'Pet peeve',              emoji:'😤' },
  { key:'dreamDate',        label:'Dream date idea',        emoji:'🌙' },
  { key:'favouriteMovie',   label:'Favourite movie',        emoji:'🎬' },
  { key:'favouriteSong',    label:'Favourite song',         emoji:'🎵' },
  { key:'note',             label:'Note to you',            emoji:'💌' },
]

function fmtBirthday(ds) {
  if (!ds) return null
  const [,m,d] = ds.split('-').map(Number)
  const today = new Date()
  let next = new Date(today.getFullYear(), m-1, d)
  if (next < today) next = new Date(today.getFullYear()+1, m-1, d)
  const days = Math.round((next - today) / 86400000)
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dateStr = `${MONTHS[m-1]} ${d}`
  if (days === 0) return `${dateStr} 🎉 Today!`
  if (days <= 7)  return `${dateStr} · in ${days} days 🎂`
  return dateStr
}

export default function PartnerPage() {
  const { partner, isLinked } = useAuth()
  const { C } = useTheme()
  const navigate = useNavigate()
  const [extras, setExtras] = useState(null) // null = loading

  useEffect(() => {
    if (!partner?.id) return
    supabase.from('profiles').select('extras').eq('id', partner.id).single()
      .then(({ data }) => setExtras(data?.extras || {}))
  }, [partner?.id])

  const filled = FIELD_DEFS.filter(f => extras?.[f.key])
  const birthday = extras?.birthday ? fmtBirthday(extras.birthday) : null

  if (!isLinked) {
    return (
      <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'var(--bg)',fontFamily:"'Nunito',sans-serif",color:'var(--text)'}}>
        <header style={{height:48,display:'flex',alignItems:'center',justifyContent:'center',borderBottom:`1px solid ${C.border}`,background:C.surface}}>
          <div style={{fontFamily:"'Playfair Display'",fontSize:18,color:C.text}}>Partner</div>
        </header>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center'}}>
          <div style={{fontSize:52,marginBottom:16}}>🌷</div>
          <div style={{fontFamily:"'Playfair Display'",fontSize:22,color:C.text,marginBottom:8}}>No partner linked yet</div>
          <p style={{fontSize:14,color:C.textMid,maxWidth:300,lineHeight:1.7,marginBottom:24}}>
            Connect with your partner to see their profile here.
          </p>
          <button onClick={()=>navigate('/connect')} style={{background:C.peach,color:'#fff',border:'none',borderRadius:14,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Connect now 💕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:C.bg,fontFamily:"'Nunito',sans-serif",color:C.text,overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased}`}</style>

      <header style={{flexShrink:0,height:48,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'center',borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{fontFamily:"'Playfair Display'",fontSize:18,color:C.text}}>
          {partner?.name || 'Partner'}
        </div>
      </header>

      <div style={{flex:1,overflowY:'auto',padding:'0 20px 40px'}}>
        <div style={{maxWidth:520,margin:'0 auto'}}>

          {/* Hero card */}
          <div style={{
            margin:'24px 0 20px',
            background:`linear-gradient(135deg, ${C.rose}18, ${C.lavender}18)`,
            border:`1.5px solid ${C.rose}33`,
            borderRadius:20, padding:'24px',
            display:'flex', alignItems:'center', gap:18,
          }}>
            {/* Avatar */}
            <div style={{
              width:80, height:80, borderRadius:'50%', flexShrink:0,
              background: partner?.avatarUrl ? 'transparent' : C.rose+'33',
              border:`3px solid ${C.rose}55`,
              display:'flex', alignItems:'center', justifyContent:'center',
              overflow:'hidden',
            }}>
              {partner?.avatarUrl
                ? <img src={partner.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <span style={{fontSize:36}}>🌷</span>
              }
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display'",fontSize:24,color:C.text,lineHeight:1.1,marginBottom:4}}>
                {partner?.name || 'Partner'}
              </div>
              <div style={{fontSize:12,color:C.rose,fontWeight:700}}>Your partner 💕</div>
              {birthday && (
                <div style={{
                  marginTop:8, display:'inline-flex', alignItems:'center', gap:5,
                  background:C.rose+'18', border:`1px solid ${C.rose}33`,
                  borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700, color:C.rose,
                }}>
                  🎂 {birthday}
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {extras === null && (
            <div style={{textAlign:'center',padding:40,color:C.textDim,fontSize:13}}>✿ Loading…</div>
          )}

          {/* Empty */}
          {extras !== null && filled.length === 0 && (
            <div style={{textAlign:'center',padding:'32px 20px',color:C.textDim}}>
              <div style={{fontSize:36,marginBottom:8}}>🌱</div>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>
                {partner?.name} hasn't filled in their profile yet.<br/>
                <span style={{color:C.textDim}}>Maybe give them a nudge 💌</span>
              </div>
            </div>
          )}

          {/* Fields */}
          {extras !== null && filled.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filled.map(f => (
                <div key={f.key} style={{
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:14, padding:'12px 16px',
                  display:'flex', gap:12, alignItems:'flex-start',
                  transition:'border-color 0.15s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.rose+'55'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
                >
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{f.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:C.textDim,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700,marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,color:C.text,lineHeight:1.6,wordBreak:'break-word'}}>
                      {f.key==='birthday' ? fmtBirthday(extras[f.key]) || extras[f.key] : extras[f.key]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}