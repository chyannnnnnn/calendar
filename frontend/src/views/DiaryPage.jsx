import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const TAGS = [
  { key:'everyday',    label:'Everyday',    emoji:'🌿' },
  { key:'date',        label:'Date night',  emoji:'🌙' },
  { key:'anniversary', label:'Anniversary', emoji:'💍' },
  { key:'milestone',   label:'Milestone',   emoji:'✨' },
  { key:'travel',      label:'Travel',      emoji:'✈️' },
  { key:'memory',      label:'Memory',      emoji:'📸' },
]
const MOODS = ['😊','🥰','😌','🥺','😂','🤩','😢','😴','🌸','💕','✨','🔥']

function toDateStr(d) { return d.toISOString().slice(0,10) }
function parseLocal(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }
function fmtLong(ds) {
  return parseLocal(ds).toLocaleDateString('en',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
}
function fmtShort(ds) {
  return parseLocal(ds).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})
}
function fmtMonth(ym) {
  const [y,m]=ym.split('-')
  return new Date(+y,+m-1,1).toLocaleDateString('en',{month:'long',year:'numeric'})
}

// ── Label helper ──────────────────────────────────────────────────────────────
function Label({ children, C }) {
  return (
    <div style={{
      fontSize:10, fontWeight:800, textTransform:'uppercase',
      letterSpacing:'0.1em', color:C.textDim, marginBottom:8,
    }}>{children}</div>
  )
}

// ── Entry Card ────────────────────────────────────────────────────────────────
function EntryCard({ entry, name, color, tag, C, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background:C.surface, border:`1.5px solid ${hov ? color : C.border}`,
        borderRadius:16, overflow:'hidden', cursor:'pointer',
        transition:'all 0.18s',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 8px 28px rgba(0,0,0,0.12)` : '0 2px 8px rgba(0,0,0,0.05)',
      }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${color}00,${color}bb,${color}00)` }}/>
      <div style={{ padding:'13px 15px', display:'flex', gap:12, alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
            <span style={{
              background:C.peach+'18', color:C.peach, borderRadius:20,
              padding:'2px 9px', fontSize:10, fontWeight:700,
            }}>{tag.emoji} {tag.label}</span>
            <span style={{ fontSize:11, color:C.textDim }}>{fmtShort(entry.date)}</span>
          </div>
          <div style={{
            fontFamily:"'Playfair Display'", fontSize:15, color:C.text, fontWeight:600,
            marginBottom:5, lineHeight:1.3,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>{entry.title}</div>
          <div style={{
            fontSize:12, color:C.textMid, lineHeight:1.6,
            overflow:'hidden', display:'-webkit-box',
            WebkitLineClamp:2, WebkitBoxOrient:'vertical',
          }}>{entry.body}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:color }}/>
            <span style={{ fontSize:11, color, fontWeight:700 }}>{name}</span>
            {entry.mood && <span style={{ fontSize:14 }}>{entry.mood}</span>}
          </div>
        </div>
        {entry.photo_url && (
          <img src={entry.photo_url} alt="" style={{
            width:68, height:68, borderRadius:10, objectFit:'cover',
            flexShrink:0, border:`1px solid ${C.border}`,
          }}/>
        )}
      </div>
    </div>
  )
}

// ── Main DiaryPage ────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const { user, partner, partnershipId, isLinked } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [screen,     setScreen]     = useState('list')  // 'list'|'write'|'view'
  const [active,     setActive]     = useState(null)
  const [filterTag,  setFilterTag]  = useState('all')
  const [filterWho,  setFilterWho]  = useState('all')
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState(null)
  const [delConfirm, setDelConfirm] = useState(false)
  const fileRef = useRef()

  const blank = { title:'', body:'', date:toDateStr(new Date()), mood:'🥰', tag:'everyday', photo_url:null }
  const [form, setForm] = useState(blank)

  useEffect(() => {
    if (!partnershipId) { setLoading(false); return }
    load()
    const ch = supabase.channel('diary-'+partnershipId)
      .on('postgres_changes',{event:'*',schema:'public',table:'diary_entries',
        filter:`partnership_id=eq.${partnershipId}`}, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [partnershipId])

  async function load() {
    const { data } = await supabase.from('diary_entries').select('*')
      .eq('partnership_id', partnershipId)
      .order('date',{ascending:false}).order('created_at',{ascending:false})
    setEntries(data||[])
    setLoading(false)
  }

  function showToast(msg, type='success') {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      const isEdit = !!(active && active.id)
      const row = {
        id: isEdit ? active.id : crypto.randomUUID(),
        partnership_id: partnershipId, author_id: user.id,
        date: form.date, title: form.title.trim(), body: form.body.trim(),
        mood: form.mood, tag: form.tag, photo_url: form.photo_url,
        updated_at: new Date().toISOString(),
        ...(!isEdit && { created_at: new Date().toISOString() }),
      }
      const { error } = isEdit
        ? await supabase.from('diary_entries').update(row).eq('id',active.id)
        : await supabase.from('diary_entries').insert(row)
      if (error) throw error
      await load()
      setScreen('list'); setActive(null); setForm(blank)
      showToast(isEdit ? '✿ Entry updated!' : '✿ Memory saved!')
    } catch { showToast('Could not save. Try again.','error') }
    finally  { setSaving(false) }
  }

  async function del() {
    await supabase.from('diary_entries').delete().eq('id',active.id)
    await load()
    setScreen('list'); setActive(null); setDelConfirm(false)
    showToast('Entry deleted.')
  }

  function startWrite(entry=null) {
    if (entry) {
      setForm({ title:entry.title, body:entry.body, date:entry.date,
        mood:entry.mood||'🥰', tag:entry.tag||'everyday', photo_url:entry.photo_url||null })
      setActive(entry)
    } else { setForm(blank); setActive(null) }
    setScreen('write')
  }

  function handlePhoto(e) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => setForm(p=>({...p, photo_url:ev.target.result}))
    r.readAsDataURL(f)
  }

  const filtered = entries.filter(e => {
    if (filterTag!=='all' && e.tag!==filterTag) return false
    if (filterWho==='mine'    && e.author_id!==user?.id) return false
    if (filterWho==='partner' && e.author_id===user?.id) return false
    return true
  })
  const grouped = {}
  filtered.forEach(e => { const k=e.date.slice(0,7); (grouped[k]||(grouped[k]=[])).push(e) })
  const months = Object.keys(grouped).sort().reverse()

  const whoName  = e => e.author_id===user?.id ? (user?.name||'You') : (partner?.name||'Partner')
  const whoColor = e => e.author_id===user?.id ? C.mint : C.rose
  const tagOf    = k => TAGS.find(t=>t.key===k)||TAGS[0]

  const fieldStyle = (extra={}) => ({
    width:'100%', background: mode==='dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border:`1.5px solid ${C.border}`, borderRadius:12,
    padding:'12px 14px', color:C.text, fontSize:14, lineHeight:1.6,
    outline:'none', fontFamily:"'Lora',serif", boxSizing:'border-box', ...extra,
  })

  return (
    <div style={{
      height:'100dvh', display:'flex', flexDirection:'column',
      background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text, overflow:'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        textarea{resize:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* ── Header ── */}
      <header style={{
        flexShrink:0, height:52, padding:'0 16px',
        display:'flex', alignItems:'center', gap:10,
        borderBottom:`1px solid ${C.border}`, background:C.surface, zIndex:10,
      }}>
        <button onClick={()=>navigate('/')} style={{
          background:'none', border:`1px solid ${C.border}`, color:C.textMid,
          borderRadius:10, padding:'5px 11px', fontSize:12, cursor:'pointer',
          fontFamily:'inherit', fontWeight:700,
        }}>← Calendar</button>
        <div style={{ flex:1, textAlign:'center', fontFamily:"'Playfair Display'", fontSize:19, color:C.text }}>
          us<span style={{color:C.peach}}>.</span>diary
        </div>
        <button onClick={toggleTheme} style={{
          background:'none', border:`1px solid ${C.border}`, borderRadius:10,
          padding:'5px 10px', cursor:'pointer', fontSize:13, color:C.textMid, fontFamily:'inherit', fontWeight:700,
        }}>{mode==='light'?'🌙':'☀️'}</button>
      </header>

      {/* ── Not linked ── */}
      {!isLinked && (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center'}}>
          <div style={{fontSize:52,marginBottom:16}}>📖</div>
          <div style={{fontFamily:"'Playfair Display'",fontSize:22,color:C.text,marginBottom:8}}>Your shared diary</div>
          <p style={{fontSize:14,color:C.textMid,maxWidth:300,lineHeight:1.7,marginBottom:24}}>Connect with your partner to start your shared story.</p>
          <button onClick={()=>navigate('/connect')} style={{background:C.peach,color:'#fff',border:'none',borderRadius:14,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Connect now 💕</button>
        </div>
      )}

      {/* ══ LIST SCREEN ══ */}
      {isLinked && screen==='list' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Filter bar */}
          <div style={{flexShrink:0,padding:'10px 16px',borderBottom:`1px solid ${C.border}`,background:C.surface,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
              {[{key:'all',label:'All',emoji:'📚'},...TAGS].map(t=>(
                <button key={t.key} onClick={()=>setFilterTag(t.key)} style={{
                  flexShrink:0,
                  background:filterTag===t.key?C.peach:'transparent',
                  color:filterTag===t.key?'#fff':C.textMid,
                  border:`1px solid ${filterTag===t.key?C.peach:C.border}`,
                  borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,
                  cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',
                }}>{t.emoji} {t.label}</button>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',background:C.bg,border:`1px solid ${C.border}`,borderRadius:20,padding:2,gap:1}}>
                {[['all','Both'],['mine',user?.name||'Me'],['partner',partner?.name||'Partner']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFilterWho(v)} style={{
                    background:filterWho===v?C.lavender:'transparent',color:filterWho===v?'#fff':C.textDim,
                    border:'none',borderRadius:18,padding:'4px 10px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
                  }}>{l}</button>
                ))}
              </div>
              <div style={{flex:1}}/>
              {entries.length>0&&<span style={{fontSize:11,color:C.textDim,fontWeight:600}}>{filtered.length} {filtered.length===1?'entry':'entries'}</span>}
              <button onClick={()=>startWrite()} style={{
                background:C.peach,color:'#fff',border:'none',borderRadius:20,
                padding:'7px 16px',fontSize:12,fontWeight:800,cursor:'pointer',
                display:'flex',alignItems:'center',gap:5,
                boxShadow:`0 2px 10px ${C.peach}55`,
              }}>✏️ Write</button>
            </div>
          </div>
          {/* Entry list */}
          <div style={{flex:1,overflowY:'auto',padding:'12px 16px 32px'}}>
            {loading && <div style={{textAlign:'center',padding:48,color:C.textDim,fontSize:13}}>✿ Loading memories…</div>}
            {!loading && filtered.length===0 && (
              <div style={{textAlign:'center',padding:'48px 20px',animation:'fadeIn 0.4s ease'}}>
                <div style={{fontSize:52,marginBottom:12}}>📖</div>
                <div style={{fontFamily:"'Playfair Display'",fontSize:20,color:C.textMid,marginBottom:8}}>
                  {entries.length===0?'Your story starts here':'No matches'}
                </div>
                <div style={{fontSize:13,color:C.textDim,marginBottom:24,lineHeight:1.7}}>
                  {entries.length===0?'Write your first memory — a date, an anniversary, a quiet moment.':'Try a different filter.'}
                </div>
                {entries.length===0&&(
                  <button onClick={()=>startWrite()} style={{background:C.peach,color:'#fff',border:'none',borderRadius:14,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Write first memory ✏️</button>
                )}
              </div>
            )}
            {months.map((ym,mi)=>(
              <div key={ym} style={{marginBottom:24,animation:`fadeUp 0.3s ease ${mi*0.05}s both`}}>
                <div style={{fontSize:10,color:C.textDim,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,height:1,background:C.border}}/>
                  {fmtMonth(ym)}
                  <div style={{flex:1,height:1,background:C.border}}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {grouped[ym].map(e=>(
                    <EntryCard key={e.id} entry={e} name={whoName(e)} color={whoColor(e)} tag={tagOf(e.tag)} C={C} onClick={()=>{setActive(e);setScreen('view')}}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ WRITE SCREEN ══ */}
      {isLinked && screen==='write' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Sub-header */}
          <div style={{flexShrink:0,height:48,padding:'0 16px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.border}`,background:C.surface}}>
            <button onClick={()=>{setScreen(active?'view':'list')}} style={{background:'none',border:'none',color:C.textMid,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700,padding:0}}>← Back</button>
            <div style={{flex:1,fontFamily:"'Playfair Display'",fontSize:16,color:C.text,textAlign:'center'}}>{active?'Edit memory':'New memory ✏️'}</div>
            <button onClick={save} disabled={saving||!form.title.trim()||!form.body.trim()} style={{
              background:(form.title.trim()&&form.body.trim())?C.mint:C.border,
              color:'#fff',border:'none',borderRadius:20,padding:'6px 16px',
              fontSize:12,fontWeight:800,cursor:(form.title.trim()&&form.body.trim())?'pointer':'default',
              fontFamily:'inherit',transition:'all 0.15s',
              boxShadow:(form.title.trim()&&form.body.trim())?`0 2px 10px ${C.mint}55`:'none',
            }}>{saving?'…':'Save ✿'}</button>
          </div>
          {/* Scrollable form */}
          <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
            <div style={{maxWidth:560,margin:'0 auto',display:'flex',flexDirection:'column',gap:18,paddingBottom:32}}>
              {/* Date */}
              <div>
                <Label C={C}>📅 Date</Label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                  style={{...fieldStyle(),colorScheme:mode==='dark'?'dark':'light',fontFamily:'inherit'}}/>
              </div>
              {/* Tag */}
              <div>
                <Label C={C}>🏷 Type</Label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {TAGS.map(t=>(
                    <button key={t.key} onClick={()=>setForm(f=>({...f,tag:t.key}))} style={{
                      background:form.tag===t.key?C.peach+'22':'transparent',
                      color:form.tag===t.key?C.peach:C.textMid,
                      border:`1.5px solid ${form.tag===t.key?C.peach+'88':C.border}`,
                      borderRadius:20,padding:'5px 13px',fontSize:12,
                      fontWeight:form.tag===t.key?700:500,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s',
                    }}>{t.emoji} {t.label}</button>
                  ))}
                </div>
              </div>
              {/* Mood */}
              <div>
                <Label C={C}>✨ Mood</Label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {MOODS.map(m=>(
                    <button key={m} onClick={()=>setForm(f=>({...f,mood:m}))} style={{
                      background:form.mood===m?C.lavender+'22':'transparent',
                      border:`1.5px solid ${form.mood===m?C.lavender+'88':C.border}`,
                      borderRadius:10,padding:'5px 8px',fontSize:20,cursor:'pointer',
                      transform:form.mood===m?'scale(1.25)':'scale(1)',transition:'all 0.12s',lineHeight:1,
                    }}>{m}</button>
                  ))}
                </div>
              </div>
              {/* Title */}
              <div>
                <Label C={C}>✍️ Title</Label>
                <input type="text" placeholder="Give this memory a title…" autoFocus
                  value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  style={{...fieldStyle(),fontSize:16,fontWeight:600}}
                  onFocus={e=>e.target.style.borderColor=C.peach}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>
              {/* Body */}
              <div>
                <Label C={C}>💌 Write</Label>
                <textarea placeholder="What happened today? How did it feel? Write freely…"
                  value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
                  rows={9} style={{...fieldStyle(),lineHeight:1.8}}
                  onFocus={e=>e.target.style.borderColor=C.peach}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>
              {/* Photo */}
              <div>
                <Label C={C}>📷 Photo (optional)</Label>
                {form.photo_url
                  ? <div style={{position:'relative',width:'100%'}}>
                      <img src={form.photo_url} alt="" style={{width:'100%',maxHeight:220,borderRadius:14,objectFit:'cover',display:'block',border:`1px solid ${C.border}`}}/>
                      <button onClick={()=>setForm(f=>({...f,photo_url:null}))} style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                    </div>
                  : <label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,border:`2px dashed ${C.border}`,borderRadius:14,padding:'20px',cursor:'pointer',color:C.textDim,fontSize:13,fontWeight:600}}>
                      <span style={{fontSize:22}}>📷</span> Tap to add a photo
                      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto}/>
                    </label>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ VIEW SCREEN ══ */}
      {isLinked && screen==='view' && active && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Sub-header */}
          <div style={{flexShrink:0,height:48,padding:'0 16px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${C.border}`,background:C.surface}}>
            <button onClick={()=>{setScreen('list');setActive(null);setDelConfirm(false)}} style={{background:'none',border:'none',color:C.textMid,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700,padding:0}}>← Diary</button>
            <div style={{flex:1}}/>
            {active.author_id===user?.id && !delConfirm && (
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>startWrite(active)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:10,padding:'5px 12px',fontSize:12,fontWeight:700,color:C.textMid,cursor:'pointer',fontFamily:'inherit'}}>✏️ Edit</button>
                <button onClick={()=>setDelConfirm(true)} style={{background:'none',border:`1px solid ${C.rose}55`,borderRadius:10,padding:'5px 12px',fontSize:12,fontWeight:700,color:C.rose,cursor:'pointer',fontFamily:'inherit'}}>🗑</button>
              </div>
            )}
            {active.author_id===user?.id && delConfirm && (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:11,color:C.textDim}}>Delete?</span>
                <button onClick={del} style={{background:C.rose,color:'#fff',border:'none',borderRadius:10,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Yes</button>
                <button onClick={()=>setDelConfirm(false)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:10,padding:'5px 12px',fontSize:12,fontWeight:700,color:C.textMid,cursor:'pointer',fontFamily:'inherit'}}>No</button>
              </div>
            )}
          </div>
          {/* Scrollable content */}
          <div style={{flex:1,overflowY:'auto'}}>
            <div style={{maxWidth:560,margin:'0 auto',padding:'20px 16px 48px'}}>
              {active.photo_url&&(
                <img src={active.photo_url} alt="" style={{width:'100%',maxHeight:260,objectFit:'cover',borderRadius:16,marginBottom:20,display:'block',border:`1px solid ${C.border}`}}/>
              )}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                <span style={{background:C.peach+'20',color:C.peach,border:`1px solid ${C.peach}44`,borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700}}>
                  {tagOf(active.tag).emoji} {tagOf(active.tag).label}
                </span>
                <span style={{fontSize:12,color:C.textDim}}>{fmtLong(active.date)}</span>
              </div>
              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:10}}>
                <h1 style={{fontFamily:"'Playfair Display'",fontSize:26,color:C.text,fontWeight:600,lineHeight:1.25,margin:0,flex:1}}>{active.title}</h1>
                <span style={{fontSize:34,flexShrink:0,lineHeight:1}}>{active.mood}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:whoColor(active)}}/>
                <span style={{fontSize:12,color:whoColor(active),fontWeight:700}}>{whoName(active)}</span>
                <span style={{fontSize:11,color:C.textDim}}>·</span>
                <span style={{fontSize:11,color:C.textDim}}>{new Date(active.created_at).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
              <div style={{height:1,background:C.border,marginBottom:20}}/>
              <div style={{fontFamily:"'Lora',serif",fontSize:15,color:C.text,lineHeight:1.9,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{active.body}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:999,pointerEvents:'none',background:toast.type==='success'?C.mint:C.rose,color:'#fff',borderRadius:40,padding:'11px 22px',fontSize:13,fontWeight:700,whiteSpace:'nowrap',boxShadow:`0 8px 32px ${toast.type==='success'?C.mint:C.rose}66`,animation:'fadeUp 0.25s ease'}}>{toast.msg}</div>
      )}
    </div>
  )
}