import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const TAGS = [
  { key:'everyday',    label:'Everyday',    emoji:'🌿', },
  { key:'date',        label:'Date night',  emoji:'🌙', },
  { key:'anniversary', label:'Anniversary', emoji:'💍', },
  { key:'milestone',   label:'Milestone',   emoji:'✨', },
  { key:'travel',      label:'Travel',      emoji:'✈️', },
  { key:'memory',      label:'Memory',      emoji:'📸', },
]

const MOODS = ['😊','🥰','😌','🥺','😂','🤩','😢','😴','🌸','💕','✨','🔥']

function toDateStr(d) {
  return d.toISOString().slice(0,10)
}
function parseLocal(s) {
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}
function formatDate(ds) {
  const d = parseLocal(ds)
  return d.toLocaleDateString('en', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
}
function formatShort(ds) {
  const d = parseLocal(ds)
  return d.toLocaleDateString('en', { month:'short', day:'numeric', year:'numeric' })
}

// ─── DiaryPage ────────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const { user, partner, partnershipId, isLinked } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showWrite,  setShowWrite]  = useState(false)
  const [editEntry,  setEditEntry]  = useState(null)   // entry being edited
  const [viewEntry,  setViewEntry]  = useState(null)   // entry detail view
  const [filterTag,  setFilterTag]  = useState('all')
  const [filterWho,  setFilterWho]  = useState('all')  // 'all'|'mine'|'partner'
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState(null)
  const fileRef = useRef()

  // ── Form state ──
  const blankForm = {
    title:'', body:'', date: toDateStr(new Date()),
    mood:'😊', tag:'everyday', photo_url:null,
  }
  const [form, setForm] = useState(blankForm)

  // ── Load entries ──
  useEffect(() => {
    if (!partnershipId) { setLoading(false); return }
    loadEntries()

    // Realtime subscription
    const channel = supabase
      .channel('diary-' + partnershipId)
      .on('postgres_changes', {
        event: '*', schema:'public', table:'diary_entries',
        filter: `partnership_id=eq.${partnershipId}`,
      }, () => loadEntries())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [partnershipId])

  async function loadEntries() {
    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('partnership_id', partnershipId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Save entry ──
  async function saveEntry() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      const payload = {
        id:             editEntry?.id || crypto.randomUUID(),
        partnership_id: partnershipId,
        author_id:      user.id,
        date:           form.date,
        title:          form.title.trim(),
        body:           form.body.trim(),
        mood:           form.mood,
        tag:            form.tag,
        photo_url:      form.photo_url,
        updated_at:     new Date().toISOString(),
      }
      if (!editEntry) payload.created_at = new Date().toISOString()

      const { error } = editEntry
        ? await supabase.from('diary_entries').update(payload).eq('id', editEntry.id)
        : await supabase.from('diary_entries').insert(payload)

      if (error) throw error
      await loadEntries()
      setShowWrite(false)
      setEditEntry(null)
      setForm(blankForm)
      showToast(editEntry ? '✿ Entry updated!' : '✿ Memory saved!')
    } catch(e) {
      showToast('Could not save. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id) {
    await supabase.from('diary_entries').delete().eq('id', id)
    setViewEntry(null)
    await loadEntries()
    showToast('Entry deleted.', 'success')
  }

  function startEdit(entry) {
    setForm({
      title:     entry.title,
      body:      entry.body,
      date:      entry.date,
      mood:      entry.mood || '😊',
      tag:       entry.tag  || 'everyday',
      photo_url: entry.photo_url || null,
    })
    setEditEntry(entry)
    setViewEntry(null)
    setShowWrite(true)
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, photo_url: ev.target.result }))
    reader.readAsDataURL(file)
  }

  // ── Filter entries ──
  const filtered = entries.filter(e => {
    if (filterTag !== 'all' && e.tag !== filterTag) return false
    if (filterWho === 'mine'    && e.author_id !== user?.id)    return false
    if (filterWho === 'partner' && e.author_id === user?.id)    return false
    return true
  })

  // Group by year-month
  const grouped = {}
  filtered.forEach(e => {
    const key = e.date.slice(0, 7) // "YYYY-MM"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })
  const groupKeys = Object.keys(grouped).sort().reverse()

  const authorName  = (e) => e.author_id === user?.id ? (user?.name || 'You') : (partner?.name || 'Partner')
  const authorColor = (e) => e.author_id === user?.id ? C.mint : C.rose
  const tagInfo     = (key) => TAGS.find(t => t.key === key) || TAGS[0]

  const inp = {
    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 13px', color:C.text, fontSize:14,
    outline:'none', fontFamily:'inherit', boxSizing:'border-box',
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>

      {/* ── Header ── */}
      <header style={{
        padding:'0 20px', height:56, display:'flex', alignItems:'center', gap:12,
        borderBottom:`1px solid ${C.border}`, background:C.surface,
        position:'sticky', top:0, zIndex:50,
      }}>
        <button onClick={()=>navigate('/')} style={{
          background:'none', border:`1px solid ${C.border}`, color:C.textMid,
          borderRadius:10, padding:'6px 12px', fontSize:13, cursor:'pointer',
          fontFamily:'inherit', fontWeight:600,
        }}>← Calendar</button>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, color:C.text, flex:1 }}>
          us<span style={{color:C.peach}}>.</span>diary
        </div>
        <button onClick={toggleTheme} style={{
          display:'flex', alignItems:'center', gap:6,
          background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:20, padding:'5px 12px', cursor:'pointer',
          fontSize:12, fontWeight:700, color:C.textMid, fontFamily:'inherit',
        }}>
          <span>{mode==='light'?'🌙':'☀️'}</span>
          <span>{mode==='light'?'Dark':'Light'}</span>
        </button>
      </header>

      {/* ── Not linked banner ── */}
      {!isLinked && (
        <div style={{ padding:'32px 20px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📖</div>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:20, color:C.text, marginBottom:8 }}>
            Your shared diary
          </div>
          <p style={{ fontSize:14, color:C.textMid, marginBottom:20, maxWidth:320, margin:'0 auto 20px' }}>
            Connect with your partner to start writing your shared diary together.
          </p>
          <button onClick={()=>navigate('/connect')} style={{
            background:C.peach, color:'#fff', border:'none',
            borderRadius:14, padding:'12px 24px', fontSize:14, fontWeight:700, cursor:'pointer',
          }}>Connect now 💕</button>
        </div>
      )}

      {isLinked && (
        <div style={{ maxWidth:640, margin:'0 auto', padding:'0 16px 80px' }}>

          {/* ── Filters + Write button ── */}
          <div style={{ padding:'14px 0 10px', display:'flex', flexDirection:'column', gap:10 }}>
            {/* Tag filter */}
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
              <button onClick={()=>setFilterTag('all')} style={{
                flexShrink:0, background: filterTag==='all' ? C.peach : C.surface,
                color: filterTag==='all' ? '#fff' : C.textMid,
                border:`1px solid ${filterTag==='all' ? C.peach : C.border}`,
                borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit',
              }}>All</button>
              {TAGS.map(t => (
                <button key={t.key} onClick={()=>setFilterTag(t.key)} style={{
                  flexShrink:0,
                  background: filterTag===t.key ? C.peach+'22' : C.surface,
                  color:      filterTag===t.key ? C.peach : C.textMid,
                  border:`1px solid ${filterTag===t.key ? C.peach+'66' : C.border}`,
                  borderRadius:20, padding:'5px 12px', fontSize:12, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                }}>{t.emoji} {t.label}</button>
              ))}
            </div>

            {/* Who filter + write button */}
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ display:'flex', background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:2, gap:1 }}>
                {[['all','Both'],['mine',user?.name||'Me'],['partner',partner?.name||'Partner']].map(([v,label])=>(
                  <button key={v} onClick={()=>setFilterWho(v)} style={{
                    background: filterWho===v ? C.lavender : 'transparent',
                    color:      filterWho===v ? '#fff' : C.textDim,
                    border:'none', borderRadius:18, padding:'4px 12px',
                    fontSize:11, fontWeight:filterWho===v?700:500, cursor:'pointer',
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ flex:1 }}/>
              <button onClick={()=>{ setForm(blankForm); setEditEntry(null); setShowWrite(true) }} style={{
                background:C.peach, color:'#fff', border:'none', borderRadius:20,
                padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
                boxShadow:`0 2px 12px ${C.peach}44`,
              }}>✏️ Write</button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          {entries.length > 0 && (
            <div style={{
              display:'flex', gap:0, background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:16, overflow:'hidden', marginBottom:16,
            }}>
              {[
                { label:'Entries', value: entries.length },
                { label:'By you',  value: entries.filter(e=>e.author_id===user?.id).length },
                { label:'By '+(partner?.name||'partner'), value: entries.filter(e=>e.author_id!==user?.id).length },
                { label:'This month', value: entries.filter(e=>e.date.startsWith(toDateStr(new Date()).slice(0,7))).length },
              ].map((s,i,arr) => (
                <div key={i} style={{
                  flex:1, padding:'12px 8px', textAlign:'center',
                  borderRight: i < arr.length-1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ fontSize:20, fontFamily:"'Playfair Display'", fontWeight:600, color:C.peach }}>{s.value}</div>
                  <div style={{ fontSize:10, color:C.textDim, fontWeight:600, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 20px', color:C.textDim }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📖</div>
              <div style={{ fontFamily:"'Playfair Display'", fontSize:18, color:C.textMid, marginBottom:8 }}>
                {entries.length === 0 ? 'Your story starts here' : 'No entries match this filter'}
              </div>
              <div style={{ fontSize:13, marginBottom:24, lineHeight:1.6 }}>
                {entries.length === 0
                  ? 'Write your first memory together — a date, a moment, an anniversary.'
                  : 'Try changing the filter above.'}
              </div>
              {entries.length === 0 && (
                <button onClick={()=>{ setForm(blankForm); setEditEntry(null); setShowWrite(true) }} style={{
                  background:C.peach, color:'#fff', border:'none', borderRadius:14,
                  padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer',
                }}>Write first entry ✏️</button>
              )}
            </div>
          )}

          {/* ── Grouped entries ── */}
          {groupKeys.map(monthKey => {
            const [y, m] = monthKey.split('-')
            const monthLabel = new Date(+y, +m-1, 1).toLocaleDateString('en', { month:'long', year:'numeric' })
            return (
              <div key={monthKey} style={{ marginBottom:28 }}>
                <div style={{
                  fontSize:11, color:C.textDim, fontWeight:800, textTransform:'uppercase',
                  letterSpacing:'0.1em', marginBottom:10, paddingLeft:4,
                }}>{monthLabel}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {grouped[monthKey].map(entry => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      authorName={authorName(entry)}
                      authorColor={authorColor(entry)}
                      tagInfo={tagInfo(entry.tag)}
                      isOwn={entry.author_id === user?.id}
                      C={C}
                      onClick={()=>setViewEntry(entry)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Write / Edit modal ── */}
      {showWrite && (
        <div onClick={()=>{ setShowWrite(false); setEditEntry(null) }} style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
          padding:'0',
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            width:'min(640px,100%)', maxHeight:'92vh',
            background:C.surface, borderRadius:'24px 24px 0 0',
            display:'flex', flexDirection:'column',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
          }}>
            {/* Handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
              <div style={{ width:40, height:4, borderRadius:2, background:C.border }}/>
            </div>

            {/* Header */}
            <div style={{
              padding:'4px 20px 12px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              borderBottom:`1px solid ${C.border}`,
            }}>
              <div style={{ fontFamily:"'Playfair Display'", fontSize:18, color:C.text }}>
                {editEntry ? '✏️ Edit entry' : '✏️ New memory'}
              </div>
              <button onClick={()=>{ setShowWrite(false); setEditEntry(null) }} style={{
                background:'none', border:`1px solid ${C.border}`, borderRadius:8,
                width:30, height:30, cursor:'pointer', color:C.textDim, fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>✕</button>
            </div>

            {/* Form body */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>

              {/* Date */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>📅 Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{...inp, colorScheme: mode==='dark'?'dark':'light'}}/>
              </div>

              {/* Tag */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>🏷 Type</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {TAGS.map(t => (
                    <button key={t.key} onClick={()=>setForm(f=>({...f,tag:t.key}))} style={{
                      background: form.tag===t.key ? C.peach+'22' : C.bg,
                      color:      form.tag===t.key ? C.peach : C.textMid,
                      border:`1.5px solid ${form.tag===t.key ? C.peach+'66' : C.border}`,
                      borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:form.tag===t.key?700:500,
                      cursor:'pointer', fontFamily:'inherit',
                    }}>{t.emoji} {t.label}</button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>✨ Mood</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {MOODS.map(m => (
                    <button key={m} onClick={()=>setForm(f=>({...f,mood:m}))} style={{
                      background: form.mood===m ? C.lavender+'22' : C.bg,
                      border:`1.5px solid ${form.mood===m ? C.lavender+'88' : C.border}`,
                      borderRadius:10, padding:'5px 8px', fontSize:18, cursor:'pointer',
                      transform: form.mood===m ? 'scale(1.2)' : 'scale(1)',
                      transition:'all 0.12s',
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>✍️ Title</label>
                <input
                  type="text" autoFocus placeholder="Give this memory a title…"
                  value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  style={inp}
                />
              </div>

              {/* Body */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>💌 Write</label>
                <textarea
                  placeholder="What happened today? How did it feel? Write freely…"
                  value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
                  rows={6}
                  style={{...inp, resize:'vertical', lineHeight:1.7}}
                />
              </div>

              {/* Photo */}
              <div>
                <label style={{ fontSize:11, color:C.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>📷 Photo (optional)</label>
                {form.photo_url
                  ? <div style={{ position:'relative', display:'inline-block' }}>
                      <img src={form.photo_url} alt="" style={{ maxHeight:180, borderRadius:12, maxWidth:'100%', objectFit:'cover', display:'block' }}/>
                      <button onClick={()=>setForm(f=>({...f,photo_url:null}))} style={{
                        position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.6)',
                        color:'#fff', border:'none', borderRadius:'50%', width:24, height:24,
                        cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center',
                      }}>✕</button>
                    </div>
                  : <label style={{
                      display:'flex', alignItems:'center', gap:10, background:C.bg,
                      border:`2px dashed ${C.border}`, borderRadius:12, padding:'14px 16px',
                      cursor:'pointer', fontSize:13, color:C.textMid, fontWeight:600,
                    }}>
                      <span style={{ fontSize:20 }}>📷</span> Add a photo
                      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload}/>
                    </label>
                }
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px 28px', borderTop:`1px solid ${C.border}`, display:'flex', gap:10 }}>
              <button onClick={()=>{ setShowWrite(false); setEditEntry(null) }} style={{
                flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:14,
                padding:13, fontSize:13, fontWeight:700, color:C.textMid, cursor:'pointer', fontFamily:'inherit',
              }}>Cancel</button>
              <button onClick={saveEntry} disabled={saving || !form.title.trim() || !form.body.trim()} style={{
                flex:2, background: (!form.title.trim()||!form.body.trim()) ? C.border : C.mint,
                color:'#fff', border:'none', borderRadius:14, padding:13,
                fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                opacity: saving ? 0.7 : 1, transition:'all 0.2s',
                boxShadow: (!form.title.trim()||!form.body.trim()) ? 'none' : `0 4px 16px ${C.mint}44`,
              }}>{saving ? '✿ Saving…' : '✿ Save memory'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View entry modal ── */}
      {viewEntry && (
        <div onClick={()=>setViewEntry(null)} style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            width:'min(640px,100%)', maxHeight:'90vh',
            background:C.surface, borderRadius:'24px 24px 0 0',
            display:'flex', flexDirection:'column',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
              <div style={{ width:40, height:4, borderRadius:2, background:C.border }}/>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 12px' }}>
              {/* Tag + date */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{
                  background: C.peach+'22', color:C.peach,
                  borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700,
                }}>{tagInfo(viewEntry.tag).emoji} {tagInfo(viewEntry.tag).label}</span>
                <span style={{ fontSize:12, color:C.textDim }}>{formatDate(viewEntry.date)}</span>
              </div>

              {/* Title + mood */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
                <div style={{ fontFamily:"'Playfair Display'", fontSize:22, color:C.text, flex:1, lineHeight:1.3 }}>
                  {viewEntry.title}
                </div>
                <span style={{ fontSize:28, flexShrink:0 }}>{viewEntry.mood}</span>
              </div>

              {/* Author */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:authorColor(viewEntry) }}/>
                <span style={{ fontSize:12, color:authorColor(viewEntry), fontWeight:700 }}>
                  {authorName(viewEntry)}
                </span>
              </div>

              {/* Photo */}
              {viewEntry.photo_url && (
                <img src={viewEntry.photo_url} alt="" style={{
                  width:'100%', borderRadius:14, marginBottom:16,
                  maxHeight:260, objectFit:'cover', display:'block',
                }}/>
              )}

              {/* Body */}
              <div style={{
                fontSize:15, color:C.text, lineHeight:1.8, whiteSpace:'pre-wrap',
                background:C.bg, borderRadius:14, padding:'14px 16px', marginBottom:16,
              }}>{viewEntry.body}</div>

              {/* Actions — only own entries */}
              {viewEntry.author_id === user?.id && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>startEdit(viewEntry)} style={{
                    flex:1, background:'none', border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'10px', fontSize:13, fontWeight:700,
                    color:C.textMid, cursor:'pointer', fontFamily:'inherit',
                  }}>✏️ Edit</button>
                  <button onClick={()=>{ if(confirm('Delete this entry?')) deleteEntry(viewEntry.id) }} style={{
                    flex:1, background:'none', border:`1px solid ${C.rose}55`,
                    borderRadius:12, padding:'10px', fontSize:13, fontWeight:700,
                    color:C.rose, cursor:'pointer', fontFamily:'inherit',
                  }}>🗑 Delete</button>
                </div>
              )}
            </div>
            <div style={{ padding:'12px 20px 28px' }}>
              <button onClick={()=>setViewEntry(null)} style={{
                width:'100%', background:C.bg, border:`1px solid ${C.border}`,
                borderRadius:14, padding:13, fontSize:14, fontWeight:700,
                color:C.textMid, cursor:'pointer', fontFamily:'inherit',
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          zIndex:500, pointerEvents:'none',
          background: toast.type==='success' ? C.mint : C.rose,
          color:'#fff', borderRadius:40, padding:'12px 24px',
          fontSize:13, fontWeight:700, whiteSpace:'nowrap',
          boxShadow:`0 8px 32px ${toast.type==='success' ? C.mint : C.rose}66`,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({ entry, authorName, authorColor, tagInfo, isOwn, C, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:C.surface, border:`1.5px solid ${C.border}`,
      borderRadius:16, overflow:'hidden', cursor:'pointer',
      transition:'all 0.15s', position:'relative',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor = authorColor; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform='translateY(0)' }}
    >
      {/* Author accent line */}
      <div style={{ height:3, background:`linear-gradient(90deg, ${authorColor}00, ${authorColor}, ${authorColor}00)` }}/>

      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          {/* Left: content */}
          <div style={{ flex:1, minWidth:0 }}>
            {/* Tag + date */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{
                fontSize:10, fontWeight:700, color:C.peach,
                background:C.peach+'18', borderRadius:20, padding:'2px 9px',
              }}>{tagInfo.emoji} {tagInfo.label}</span>
              <span style={{ fontSize:11, color:C.textDim }}>{formatShort(entry.date)}</span>
            </div>
            {/* Title */}
            <div style={{
              fontFamily:"'Playfair Display'", fontSize:16, color:C.text,
              fontWeight:600, marginBottom:5, lineHeight:1.3,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{entry.title}</div>
            {/* Body preview */}
            <div style={{
              fontSize:12, color:C.textMid, lineHeight:1.6,
              overflow:'hidden', textOverflow:'ellipsis',
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
            }}>{entry.body}</div>
            {/* Author */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:authorColor, flexShrink:0 }}/>
              <span style={{ fontSize:11, color:authorColor, fontWeight:700 }}>{authorName}</span>
              {entry.mood && <span style={{ fontSize:14, marginLeft:4 }}>{entry.mood}</span>}
            </div>
          </div>
          {/* Right: photo thumbnail */}
          {entry.photo_url && (
            <img src={entry.photo_url} alt="" style={{
              width:72, height:72, borderRadius:10, objectFit:'cover',
              flexShrink:0, border:`1px solid ${C.border}`,
            }}/>
          )}
        </div>
      </div>
    </div>
  )
}