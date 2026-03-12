import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
]

const LOVE_LANGUAGES = ['Words of Affirmation','Acts of Service','Receiving Gifts','Quality Time','Physical Touch']

const FIELD_DEFS = [
  { key:'bio',          label:'About me',        emoji:'🌸', type:'textarea',  placeholder:'A little something about yourself…' },
  { key:'mbti',         label:'MBTI',             emoji:'🧠', type:'select',   options: MBTI_TYPES, placeholder:'Pick your type' },
  { key:'loveLanguage', label:'Love language',    emoji:'💕', type:'select',   options: LOVE_LANGUAGES, placeholder:'How you feel loved' },
  { key:'birthday',     label:'Birthday',         emoji:'🎂', type:'date',     placeholder:'' },
  { key:'favouriteFood',label:'Favourite food',   emoji:'🍜', type:'text',     placeholder:'e.g. Penang laksa' },
  { key:'favouriteCafe',label:'Favourite café',   emoji:'☕', type:'text',     placeholder:'e.g. Blank Canvas' },
  { key:'hobbies',      label:'Hobbies',          emoji:'🎨', type:'text',     placeholder:'e.g. drawing, hiking, boba' },
  { key:'currentObsession', label:'Currently obsessed with', emoji:'✨', type:'text', placeholder:'e.g. Taylor Swift, vintage cameras' },
  { key:'petPeeve',     label:'Pet peeve',        emoji:'😤', type:'text',     placeholder:'e.g. people being late' },
  { key:'dreamDate',    label:'Dream date idea',  emoji:'🌙', type:'text',     placeholder:'e.g. stargazing with snacks' },
  { key:'favouriteMovie',label:'Favourite movie', emoji:'🎬', type:'text',     placeholder:'e.g. Spirited Away' },
  { key:'favouriteSong',label:'Favourite song',   emoji:'🎵', type:'text',     placeholder:'e.g. Lover by Taylor Swift' },
  { key:'note',         label:'Note to partner',  emoji:'💌', type:'textarea', placeholder:'Something you want them to know…' },
]

export default function ProfilePage() {
  const { user, partner, isLinked } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const viewing = params.get('view') || 'mine'  // 'mine' | 'partner'

  const isOwnProfile = viewing === 'mine'
  const profileId = isOwnProfile ? user?.id : partner?.id
  const profileName = isOwnProfile ? (user?.name || 'You') : (partner?.name || 'Partner')
  const profileColor = isOwnProfile ? C.mint : C.rose
  const profileEmoji = isOwnProfile ? '🌿' : '🌷'

  const [extras, setExtras] = useState({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarDraft, setAvatarDraft] = useState(null)
  const fileRef = useRef()

  // Load profile extras from Supabase
  useEffect(() => {
    if (!profileId) return
    supabase.from('profiles').select('extras, display_name').eq('id', profileId).single()
      .then(({ data }) => {
        if (data?.extras) setExtras(data.extras)
        if (data?.extras?.avatarUrl) setAvatarUrl(data.extras.avatarUrl)
      })
  }, [profileId])

  function startEdit() {
    setDraft({ ...extras })
    setAvatarDraft(avatarUrl)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft({})
    setAvatarDraft(null)
    setEditing(false)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const newExtras = { ...draft, avatarUrl: avatarDraft || extras.avatarUrl || null }
      const { error } = await supabase
        .from('profiles')
        .update({ extras: newExtras })
        .eq('id', user.id)
      if (error) throw error
      setExtras(newExtras)
      setAvatarUrl(newExtras.avatarUrl)
      setEditing(false)
    } catch (err) {
      console.error('Save failed:', err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setAvatarDraft(ev.target.result)
    reader.readAsDataURL(file)
  }

  const currentData = editing ? draft : extras
  const currentAvatar = editing ? avatarDraft : avatarUrl
  const filledFields = FIELD_DEFS.filter(f => currentData[f.key])

  const inp = (extra={}) => ({
    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'10px 13px', color:C.text, fontSize:13,
    outline:'none', fontFamily:'inherit', boxSizing:'border-box',
    ...extra,
  })

  return (
    <div style={{minHeight:'100vh', background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text, transition:'background 0.3s'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased} textarea{resize:vertical}`}</style>

      {/* ── Header ── */}
      <header style={{padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${C.border}`, background:C.surface, position:'sticky', top:0, zIndex:10}}>
        <button onClick={()=>navigate('/')} style={{background:'none', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:10, padding:'6px 12px', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600}}>
          ← Calendar
        </button>
        <div style={{fontFamily:"'Playfair Display'", fontSize:20, color:C.text, flex:1}}>
          us<span style={{color:C.peach}}>.</span>cal
        </div>
        <button onClick={toggleTheme} style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'5px 10px', fontSize:15, cursor:'pointer'}}>
          {mode==='light'?'🌙':'☀️'}
        </button>
      </header>

      {/* ── Profile switcher tabs ── */}
      <div style={{padding:'16px 20px 0', maxWidth:520, margin:'0 auto'}}>
        <div style={{display:'flex', background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:3, gap:3, marginBottom:20}}>
          {[['mine', `${profileEmoji} My Profile`], ['partner', `🌷 ${partner?.name || 'Partner'}'s Profile`]].map(([v, label])=>(
            <button key={v} onClick={()=>{ navigate(`/profile?view=${v}`); setEditing(false) }}
              style={{flex:1, border:'none', borderRadius:11, padding:'9px 0', fontSize:13,
                fontWeight: viewing===v ? 700 : 500,
                background: viewing===v ? (v==='mine'?C.mint:C.rose) : 'transparent',
                color: viewing===v ? '#fff' : C.textDim,
                cursor:'pointer', transition:'all 0.2s',
              }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{padding:'0 20px 40px', maxWidth:520, margin:'0 auto'}}>

        {/* Avatar + name */}
        <div style={{display:'flex', alignItems:'center', gap:18, marginBottom:24}}>
          <div style={{position:'relative'}}>
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background: currentAvatar ? 'transparent' : profileColor+'33',
              border:`3px solid ${profileColor}66`,
              display:'flex', alignItems:'center', justifyContent:'center',
              overflow:'hidden', flexShrink:0,
            }}>
              {currentAvatar
                ? <img src={currentAvatar} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                : <span style={{fontSize:32}}>{profileEmoji}</span>
              }
            </div>
            {editing && isOwnProfile && (
              <>
                <button onClick={()=>fileRef.current?.click()} style={{
                  position:'absolute', bottom:0, right:0,
                  background:C.peach, border:'none', borderRadius:'50%',
                  width:24, height:24, fontSize:12, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
                }}>📷</button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload}/>
              </>
            )}
          </div>
          <div>
            <div style={{fontFamily:"'Playfair Display'", fontSize:26, color:C.text, lineHeight:1.1}}>{profileName}</div>
            <div style={{fontSize:12, color:profileColor, fontWeight:700, marginTop:3}}>
              {isOwnProfile ? 'Your profile' : 'Partner\'s profile'}
            </div>
            {!isLinked && !isOwnProfile && (
              <div style={{fontSize:11, color:C.textDim, marginTop:4}}>
                Connect with a partner to see their profile
              </div>
            )}
          </div>
        </div>

        {/* ── No partner linked ── */}
        {!isOwnProfile && !isLinked && (
          <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:24, textAlign:'center'}}>
            <div style={{fontSize:36, marginBottom:10}}>🌸</div>
            <div style={{fontFamily:"'Playfair Display'", fontSize:17, color:C.text, marginBottom:8}}>No partner linked yet</div>
            <p style={{fontSize:13, color:C.textMid, marginBottom:16}}>Connect with your partner to see their profile here.</p>
            <button onClick={()=>navigate('/connect')} style={{
              background:C.peach, color:'#fff', border:'none',
              borderRadius:12, padding:'10px 20px', fontSize:13,
              fontWeight:700, cursor:'pointer',
            }}>Connect now 💕</button>
          </div>
        )}

        {/* ── View mode ── */}
        {(!editing || !isOwnProfile) && (isOwnProfile || isLinked) && (
          <div>
            {isOwnProfile && (
              <button onClick={startEdit} style={{
                width:'100%', background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:12, padding:'11px', fontSize:13, fontWeight:700,
                color:C.textMid, cursor:'pointer', marginBottom:20,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>✏️ Edit my profile</button>
            )}

            {filledFields.length === 0 && (
              <div style={{textAlign:'center', padding:'40px 20px', color:C.textDim}}>
                <div style={{fontSize:40, marginBottom:10}}>🌱</div>
                <div style={{fontSize:14, fontWeight:600, color:C.textMid, marginBottom:6}}>
                  {isOwnProfile ? 'Your profile is empty' : `${profileName}'s profile is empty`}
                </div>
                <div style={{fontSize:12}}>
                  {isOwnProfile ? 'Add some details so your partner knows you better 💕' : 'Ask them to fill it in!'}
                </div>
              </div>
            )}

            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {filledFields.map(f => (
                <div key={f.key} style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start'}}>
                  <span style={{fontSize:22, flexShrink:0, marginTop:1}}>{f.emoji}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:10, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:700, marginBottom:3}}>{f.label}</div>
                    <div style={{fontSize:14, color:C.text, lineHeight:1.6, wordBreak:'break-word'}}>{currentData[f.key]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Edit mode ── */}
        {editing && isOwnProfile && (
          <div>
            <div style={{fontSize:12, color:C.textMid, marginBottom:16, fontWeight:600}}>
              Fill in as much or as little as you like 🌸
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {FIELD_DEFS.map(f => (
                <div key={f.key}>
                  <label style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.textMid, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:700, marginBottom:6}}>
                    <span>{f.emoji}</span>{f.label}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={draft[f.key]||''}
                      onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      rows={3}
                      style={inp({resize:'vertical'})}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={draft[f.key]||''}
                      onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))}
                      style={inp({colorScheme: mode==='dark'?'dark':'light'})}
                    >
                      <option value="">{f.placeholder}</option>
                      {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      value={draft[f.key]||''}
                      onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      style={inp({colorScheme: mode==='dark'?'dark':'light'})}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── Notification settings ── */}
            <div style={{marginTop:20, padding:'14px 16px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:12}}>
              <div style={{fontSize:13, fontWeight:700, color:C.text, marginBottom:10}}>🔔 Notifications</div>
              <label style={{display:'flex', alignItems:'center', gap:12, cursor:'pointer'}}>
                <div
                  onClick={()=>setDraft(d=>({...d, emailDigest: d.emailDigest===false ? true : false}))}
                  style={{
                    width:40, height:22, borderRadius:11, position:'relative', cursor:'pointer', transition:'background 0.2s',
                    background: draft.emailDigest===false ? C.border : C.mint,
                    flexShrink:0,
                  }}
                >
                  <div style={{
                    position:'absolute', top:3, transition:'left 0.2s',
                    left: draft.emailDigest===false ? 3 : 21,
                    width:16, height:16, borderRadius:'50%', background:'#fff',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
                  }}/>
                </div>
                <div>
                  <div style={{fontSize:13, fontWeight:600, color:C.text}}>Daily morning digest</div>
                  <div style={{fontSize:11, color:C.textDim}}>Email at 8am with today's schedule, free time together & countdowns</div>
                </div>
              </label>
            </div>

            <div style={{display:'flex', gap:10, marginTop:24, position:'sticky', bottom:16}}>
              <button onClick={cancelEdit} style={{flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:12, fontSize:13, fontWeight:700, color:C.textMid, cursor:'pointer', fontFamily:'inherit'}}>
                Cancel
              </button>
              <button onClick={saveProfile} disabled={saving} style={{flex:2, background:C.mint, color:'#fff', border:'none', borderRadius:12, padding:12, fontSize:14, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1, transition:'all 0.2s', boxShadow:`0 4px 16px ${C.mint}44`}}>
                {saving ? '✿ Saving…' : '✿ Save profile'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}