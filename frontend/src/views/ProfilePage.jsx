import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const MBTI_TYPES = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']
const LOVE_LANGUAGES = ['Words of Affirmation','Acts of Service','Receiving Gifts','Quality Time','Physical Touch']
const FIELD_DEFS = [
  { key:'bio',              label:'About me',               emoji:'🌸', type:'textarea', placeholder:'A little something about yourself…' },
  { key:'mbti',             label:'MBTI',                   emoji:'🧠', type:'select',   options:MBTI_TYPES,      placeholder:'Pick your type' },
  { key:'loveLanguage',     label:'Love language',          emoji:'💕', type:'select',   options:LOVE_LANGUAGES,  placeholder:'How you feel loved' },
  { key:'birthday',         label:'Birthday',               emoji:'🎂', type:'date',     placeholder:'' },
  { key:'favouriteFood',    label:'Favourite food',         emoji:'🍜', type:'text',     placeholder:'e.g. Penang laksa' },
  { key:'favouriteCafe',    label:'Favourite café',         emoji:'☕', type:'text',     placeholder:'e.g. Blank Canvas' },
  { key:'hobbies',          label:'Hobbies',                emoji:'🎨', type:'text',     placeholder:'e.g. drawing, hiking, boba' },
  { key:'currentObsession', label:'Currently obsessed with',emoji:'✨', type:'text',     placeholder:'e.g. Taylor Swift, vintage cameras' },
  { key:'petPeeve',         label:'Pet peeve',              emoji:'😤', type:'text',     placeholder:'e.g. people being late' },
  { key:'dreamDate',        label:'Dream date idea',        emoji:'🌙', type:'text',     placeholder:'e.g. stargazing with snacks' },
  { key:'favouriteMovie',   label:'Favourite movie',        emoji:'🎬', type:'text',     placeholder:'e.g. Spirited Away' },
  { key:'favouriteSong',    label:'Favourite song',         emoji:'🎵', type:'text',     placeholder:'e.g. Lover by Taylor Swift' },
  { key:'note',             label:'Note to partner',        emoji:'💌', type:'textarea', placeholder:'Something you want them to know…' },
]

function Toggle({ on, onToggle, C }) {
  return (
    <div onClick={onToggle} style={{
      width:40, height:22, borderRadius:11, position:'relative',
      cursor:'pointer', transition:'background 0.2s', flexShrink:0,
      background: on ? C.mint : C.border,
    }}>
      <div style={{
        position:'absolute', top:3, transition:'left 0.2s',
        left: on ? 21 : 3,
        width:16, height:16, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
      }}/>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { C, mode } = useTheme()

  // ── Profile data ──────────────────────────────────────────────────────────
  const [extras,      setExtras]      = useState({})
  const [draft,       setDraft]       = useState({})
  const [editing,     setEditing]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [avatarUrl,   setAvatarUrl]   = useState(null)
  const [avatarDraft, setAvatarDraft] = useState(null)
  const fileRef = useRef()

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwSection,   setPwSection]   = useState(false)  // show/hide section
  const [pwCurrent,   setPwCurrent]   = useState('')
  const [pwNew,       setPwNew]       = useState('')
  const [pwConfirm,   setPwConfirm]   = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)
  const [pwMsg,       setPwMsg]       = useState(null)   // {text, ok}
  const [showPw,      setShowPw]      = useState(false)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  function showToast(msg, ok=true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('extras').eq('id', user.id).single()
      .then(({ data }) => {
        const e = data?.extras || {}
        setExtras(e)
        setAvatarUrl(e.avatarUrl || null)
      })
  }, [user?.id])

  function startEdit() { setDraft({...extras}); setAvatarDraft(null); setEditing(true) }
  function cancelEdit() { setDraft({}); setAvatarDraft(null); setEditing(false) }

  async function saveProfile() {
    setSaving(true)
    try {
      const newExtras = { ...draft, avatarUrl: avatarDraft !== null ? avatarDraft : (avatarUrl || null) }
      const { error } = await supabase.from('profiles').update({ extras: newExtras }).eq('id', user.id)
      if (error) throw error
      setExtras(newExtras); setAvatarUrl(newExtras.avatarUrl); setEditing(false)
      showToast('✿ Profile saved!')
    } catch(e) { showToast('Save failed: ' + e.message, false) }
    finally { setSaving(false) }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => setAvatarDraft(ev.target.result)
    r.readAsDataURL(file)
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function changePassword() {
    setPwMsg(null)
    if (!pwNew) { setPwMsg({text:'Please enter a new password.',ok:false}); return }
    if (pwNew.length < 6) { setPwMsg({text:'Password must be at least 6 characters.',ok:false}); return }
    if (pwNew !== pwConfirm) { setPwMsg({text:'Passwords do not match.',ok:false}); return }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwNew })
      if (error) throw error
      setPwMsg({text:'✓ Password updated successfully!', ok:true})
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(()=>{ setPwSection(false); setPwMsg(null) }, 2000)
    } catch(e) { setPwMsg({text: e.message, ok:false}) }
    finally { setPwSaving(false) }
  }

  async function sendResetEmail() {
    if (!user?.email) return
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/profile',
    })
    if (error) showToast('Could not send reset email.', false)
    else showToast('✉️ Reset link sent to ' + user.email)
  }

  const currentAvatar = editing ? (avatarDraft ?? avatarUrl) : avatarUrl
  const currentData   = editing ? draft : extras
  const filledFields  = FIELD_DEFS.filter(f => currentData[f.key])

  const inp = (extra={}) => ({
    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'10px 13px', color:C.text, fontSize:13,
    outline:'none', fontFamily:'inherit', boxSizing:'border-box',
    colorScheme: mode==='dark'?'dark':'light',
    ...extra,
  })

  const SectionHead = ({children}) => (
    <div style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:C.textDim,marginBottom:12,marginTop:24}}>
      {children}
    </div>
  )

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:C.bg,fontFamily:"'Nunito',sans-serif",color:C.text,overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased} textarea{resize:vertical} input::placeholder,textarea::placeholder{opacity:0.5}`}</style>

      {/* Header */}
      <header style={{flexShrink:0,height:48,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'center',borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{fontFamily:"'Playfair Display'",fontSize:18,color:C.text}}>My Profile</div>
      </header>

      <div style={{flex:1,overflowY:'auto',padding:'0 20px 40px'}}>
        <div style={{maxWidth:520,margin:'0 auto'}}>

          {/* ── Avatar + name ── */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'28px 0 20px',gap:12}}>
            <div style={{position:'relative'}}>
              <div style={{
                width:88,height:88,borderRadius:'50%',
                background:currentAvatar?'transparent':C.mint+'33',
                border:`3px solid ${C.mint}66`,
                display:'flex',alignItems:'center',justifyContent:'center',
                overflow:'hidden',
              }}>
                {currentAvatar
                  ? <img src={currentAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{fontSize:36}}>🌿</span>
                }
              </div>
              {editing && (
                <>
                  <button onClick={()=>fileRef.current?.click()} style={{
                    position:'absolute',bottom:2,right:2,
                    background:C.peach,border:`2px solid ${C.surface}`,
                    borderRadius:'50%',width:26,height:26,fontSize:12,
                    cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                  }}>📷</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload}/>
                </>
              )}
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Playfair Display'",fontSize:22,color:C.text}}>{user?.name||'You'}</div>
              <div style={{fontSize:12,color:C.textDim,marginTop:2}}>{user?.email}</div>
            </div>
            {!editing && (
              <button onClick={startEdit} style={{
                background:C.surface,border:`1px solid ${C.border}`,
                borderRadius:20,padding:'7px 20px',fontSize:12,fontWeight:700,
                color:C.textMid,cursor:'pointer',fontFamily:'inherit',
              }}>✏️ Edit profile</button>
            )}
          </div>

          {/* ── View mode ── */}
          {!editing && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filledFields.length === 0 && (
                <div style={{textAlign:'center',padding:'32px 20px',color:C.textDim}}>
                  <div style={{fontSize:36,marginBottom:8}}>🌱</div>
                  <div style={{fontSize:13,color:C.textMid}}>Your profile is empty — tap Edit to fill it in 💕</div>
                </div>
              )}
              {filledFields.map(f=>(
                <div key={f.key} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'12px 16px',display:'flex',gap:12,alignItems:'flex-start'}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{f.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:C.textDim,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700,marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,color:C.text,lineHeight:1.6,wordBreak:'break-word'}}>{currentData[f.key]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Edit mode ── */}
          {editing && (
            <div>
              <SectionHead>About you</SectionHead>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {FIELD_DEFS.map(f=>(
                  <div key={f.key}>
                    <label style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:C.textDim,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700,marginBottom:5}}>
                      <span>{f.emoji}</span>{f.label}
                    </label>
                    {f.type==='textarea' ? (
                      <textarea value={draft[f.key]||''} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))} placeholder={f.placeholder} rows={3} style={inp({resize:'vertical'})}/>
                    ) : f.type==='select' ? (
                      <select value={draft[f.key]||''} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))} style={inp()}>
                        <option value="">{f.placeholder}</option>
                        {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} value={draft[f.key]||''} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))} placeholder={f.placeholder}
                        {...(f.key==='birthday' ? {max:new Date().toISOString().slice(0,10)} : {})}
                        style={inp()}
                      />
                    )}
                  </div>
                ))}
              </div>

              <SectionHead>Notifications</SectionHead>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 16px'}}>
                <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <Toggle on={draft.emailDigest !== false} onToggle={()=>setDraft(d=>({...d,emailDigest:d.emailDigest===false?true:false}))} C={C}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>Daily morning digest</div>
                    <div style={{fontSize:11,color:C.textDim}}>Email at 8am with today's schedule & free time together</div>
                  </div>
                </label>
              </div>

              {/* Save / Cancel */}
              <div style={{display:'flex',gap:10,marginTop:20,position:'sticky',bottom:16}}>
                <button onClick={cancelEdit} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:12,fontSize:13,fontWeight:700,color:C.textMid,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={saveProfile} disabled={saving} style={{flex:2,background:C.mint,color:'#fff',border:'none',borderRadius:12,padding:12,fontSize:14,fontWeight:700,cursor:'pointer',opacity:saving?0.7:1,boxShadow:`0 4px 16px ${C.mint}44`,fontFamily:'inherit'}}>
                  {saving ? '✿ Saving…' : '✿ Save profile'}
                </button>
              </div>
            </div>
          )}

          {/* ── Password & Security ── */}
          {!editing && (
            <>
              <SectionHead>Password & Security</SectionHead>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>

                {/* Toggle row */}
                <button onClick={()=>setPwSection(o=>!o)} style={{
                  width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'14px 16px',background:'none',border:'none',cursor:'pointer',
                  fontFamily:'inherit',
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:18}}>🔑</span>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Change password</div>
                      <div style={{fontSize:11,color:C.textDim}}>Update your account password</div>
                    </div>
                  </div>
                  <span style={{color:C.textDim,fontSize:12}}>{pwSection?'▲':'▼'}</span>
                </button>

                {pwSection && (
                  <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{height:8}}/>
                    {/* New password */}
                    <div>
                      <label style={{fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:5}}>New password</label>
                      <div style={{position:'relative'}}>
                        <input
                          type={showPw?'text':'password'}
                          placeholder="At least 6 characters"
                          value={pwNew} onChange={e=>setPwNew(e.target.value)}
                          style={{...inp(),paddingRight:40}}
                        />
                        <button onClick={()=>setShowPw(o=>!o)} style={{
                          position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                          background:'none',border:'none',cursor:'pointer',color:C.textDim,fontSize:14,
                        }}>{showPw?'🙈':'👁️'}</button>
                      </div>
                    </div>
                    {/* Confirm */}
                    <div>
                      <label style={{fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:5}}>Confirm new password</label>
                      <input
                        type={showPw?'text':'password'}
                        placeholder="Re-enter new password"
                        value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&changePassword()}
                        style={inp()}
                      />
                    </div>
                    {/* Message */}
                    {pwMsg && (
                      <div style={{fontSize:12,fontWeight:600,color:pwMsg.ok?C.mint:C.rose,padding:'8px 12px',background:(pwMsg.ok?C.mint:C.rose)+'18',borderRadius:8}}>
                        {pwMsg.text}
                      </div>
                    )}
                    {/* Buttons */}
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={changePassword} disabled={pwSaving||!pwNew||!pwConfirm} style={{
                        flex:2,background:(pwNew&&pwConfirm)?C.mint:C.border,color:'#fff',
                        border:'none',borderRadius:10,padding:'10px',fontSize:13,fontWeight:700,
                        cursor:(pwNew&&pwConfirm)?'pointer':'default',fontFamily:'inherit',
                        transition:'all 0.15s',
                      }}>{pwSaving?'Saving…':'Update password'}</button>
                      <button onClick={()=>{setPwSection(false);setPwNew('');setPwConfirm('');setPwMsg(null)}} style={{
                        flex:1,background:'none',border:`1px solid ${C.border}`,borderRadius:10,
                        padding:'10px',fontSize:13,fontWeight:700,color:C.textMid,cursor:'pointer',fontFamily:'inherit',
                      }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Forgot password */}
                <button onClick={sendResetEmail} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:10,
                  padding:'14px 16px',background:'none',border:'none',cursor:'pointer',
                  borderTop:`1px solid ${C.border}`,fontFamily:'inherit',
                }}>
                  <span style={{fontSize:18}}>✉️</span>
                  <div style={{textAlign:'left'}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>Forgot password?</div>
                    <div style={{fontSize:11,color:C.textDim}}>Send a reset link to {user?.email}</div>
                  </div>
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:999,pointerEvents:'none',background:toast.ok?C.mint:C.rose,color:'#fff',borderRadius:40,padding:'11px 22px',fontSize:13,fontWeight:700,whiteSpace:'nowrap',boxShadow:`0 8px 32px rgba(0,0,0,0.2)`}}>{toast.msg}</div>
      )}
    </div>
  )
}