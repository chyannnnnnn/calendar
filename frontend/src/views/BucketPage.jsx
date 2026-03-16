import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const CATS = [
  { key:'travel',     label:'Travel',      emoji:'✈️',  color:'#4BAF84' },
  { key:'food',       label:'Food',        emoji:'🍜',  color:'#E87840' },
  { key:'experience', label:'Experience',  emoji:'✨',  color:'#8B72BE' },
  { key:'creative',   label:'Creative',    emoji:'🎨',  color:'#D4607A' },
  { key:'milestone',  label:'Milestone',   emoji:'💍',  color:'#D4920A' },
]

export default function BucketPage() {
  const { user, partner, partnershipId, isLinked } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')  // 'all'|'todo'|'done'|cat key
  const [showAdd,   setShowAdd]   = useState(false)
  const [text,      setText]      = useState('')
  const [cat,       setCat]       = useState('experience')
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [celebrate, setCelebrate] = useState(null) // item just ticked

  useEffect(() => {
    if (!partnershipId) { setLoading(false); return }
    load()
    const ch = supabase.channel('bucket-' + partnershipId)
      .on('postgres_changes', { event:'*', schema:'public', table:'bucket_items',
        filter: `partnership_id=eq.${partnershipId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [partnershipId])

  async function load() {
    const { data } = await supabase.from('bucket_items').select('*')
      .eq('partnership_id', partnershipId)
      .order('done', { ascending: true })
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  async function addItem() {
    if (!text.trim()) return
    setSaving(true)
    const item = {
      id: crypto.randomUUID(),
      partnership_id: partnershipId, author_id: user.id,
      text: text.trim(), category: cat,
      done: false, created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('bucket_items').insert(item)
    if (!error) {
      await load()
      setText(''); setShowAdd(false)
      showToast('✿ Added to your list!')
    }
    setSaving(false)
  }

  async function toggleDone(item) {
    const newDone = !item.done
    await supabase.from('bucket_items').update({
      done: newDone,
      done_by: newDone ? user.id : null,
      done_at: newDone ? new Date().toISOString() : null,
    }).eq('id', item.id)
    if (newDone) {
      setCelebrate(item.id)
      setTimeout(() => setCelebrate(null), 2000)
      showToast(`🎉 "${item.text}" — done!`)
    }
    await load()
  }

  async function deleteItem(id) {
    await supabase.from('bucket_items').delete().eq('id', id)
    await load()
  }

  const catOf = k => CATS.find(c=>c.key===k) || CATS[2]
  const whoAdded = item => item.author_id===user?.id ? (user?.name||'You') : (partner?.name||'Partner')
  const whoColor = item => item.author_id===user?.id ? C.mint : C.rose

  const filtered = items.filter(item => {
    if (filter === 'todo') return !item.done
    if (filter === 'done') return item.done
    if (CATS.find(c=>c.key===filter)) return item.category===filter
    return true
  })

  const doneCount = items.filter(i=>i.done).length
  const todoCount = items.filter(i=>!i.done).length
  const pct = items.length ? Math.round((doneCount/items.length)*100) : 0

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text, overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
        .tick-pop{animation:pop 0.3s ease}
      `}</style>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:52, padding:'0 16px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${C.border}`, background:C.surface, zIndex:10 }}>
        <button onClick={()=>navigate('/')} style={{ background:'none', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:10, padding:'5px 11px', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>← Calendar</button>
        <div style={{ flex:1, textAlign:'center', fontFamily:"'Playfair Display'", fontSize:19, color:C.text }}>
          🪣 Bucket List
        </div>
        <button onClick={toggleTheme} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:10, padding:'5px 10px', cursor:'pointer', fontSize:13, color:C.textMid, fontFamily:'inherit', fontWeight:700 }}>{mode==='light'?'🌙':'☀️'}</button>
      </header>

      {!isLinked && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🪣</div>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:22, color:C.text, marginBottom:8 }}>Your shared bucket list</div>
          <p style={{ fontSize:14, color:C.textMid, maxWidth:300, lineHeight:1.7, marginBottom:24 }}>Connect with your partner to build your list of dreams together.</p>
          <button onClick={()=>navigate('/connect')} style={{ background:C.peach, color:'#fff', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Connect now 💕</button>
        </div>
      )}

      {isLinked && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

          {/* Progress bar + stats */}
          {items.length > 0 && (
            <div style={{ flexShrink:0, padding:'10px 16px 8px', borderBottom:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                <div style={{ fontSize:12, color:C.textMid, fontWeight:700 }}>{doneCount} / {items.length} done</div>
                <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${C.mint},${C.lavender})`, borderRadius:3, transition:'width 0.5s ease' }}/>
                </div>
                <div style={{ fontSize:12, color:C.mint, fontWeight:800 }}>{pct}%</div>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ flexShrink:0, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', gap:6, overflowX:'auto', alignItems:'center' }}>
            {[
              {key:'all',  label:'All',     emoji:'📋'},
              {key:'todo', label:'To do',   emoji:'⭕'},
              {key:'done', label:'Done',    emoji:'✅'},
              ...CATS
            ].map(f => (
              <button key={f.key} onClick={()=>setFilter(f.key)} style={{
                flexShrink:0,
                background: filter===f.key ? C.peach : 'transparent',
                color: filter===f.key ? '#fff' : C.textMid,
                border:`1px solid ${filter===f.key ? C.peach : C.border}`,
                borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              }}>{f.emoji} {f.label}</button>
            ))}
            <div style={{ flex:1 }}/>
            <button onClick={()=>setShowAdd(true)} style={{
              background:C.peach, color:'#fff', border:'none', borderRadius:20,
              padding:'7px 16px', fontSize:12, fontWeight:800, cursor:'pointer',
              display:'flex', alignItems:'center', gap:5, flexShrink:0,
              boxShadow:`0 2px 10px ${C.peach}55`,
            }}>＋ Add</button>
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 32px' }}>
            {loading && <div style={{ textAlign:'center', padding:48, color:C.textDim, fontSize:13 }}>✿ Loading…</div>}

            {!loading && filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 20px', animation:'fadeUp 0.4s ease' }}>
                <div style={{ fontSize:52, marginBottom:12 }}>{filter==='done'?'🎉':'🌱'}</div>
                <div style={{ fontFamily:"'Playfair Display'", fontSize:18, color:C.textMid, marginBottom:8 }}>
                  {filter==='done'?'Nothing ticked off yet':items.length===0?'Your bucket list is empty':'No matches'}
                </div>
                <div style={{ fontSize:13, color:C.textDim, marginBottom:24, lineHeight:1.7 }}>
                  {items.length===0?'Add things you want to experience together — places, food, adventures, milestones.':'Try a different filter.'}
                </div>
                {items.length===0&&<button onClick={()=>setShowAdd(true)} style={{ background:C.peach, color:'#fff', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Add first dream ✨</button>}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:8, maxWidth:600, margin:'0 auto' }}>
              {filtered.map((item, idx) => {
                const c = catOf(item.category)
                const isCelebrating = celebrate === item.id
                return (
                  <div key={item.id} className={isCelebrating ? 'tick-pop' : ''} style={{
                    background: item.done ? C.bg : C.surface,
                    border:`1.5px solid ${item.done ? C.border : c.color+'44'}`,
                    borderRadius:14, padding:'12px 14px',
                    display:'flex', alignItems:'center', gap:12,
                    opacity: item.done ? 0.65 : 1,
                    transition:'all 0.2s',
                    animation: `fadeUp 0.25s ease ${idx*0.03}s both`,
                  }}>
                    {/* Checkbox */}
                    <button
                      onClick={()=>toggleDone(item)}
                      style={{
                        width:28, height:28, borderRadius:'50%', flexShrink:0,
                        background: item.done ? C.mint : 'transparent',
                        border:`2px solid ${item.done ? C.mint : C.border}`,
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, transition:'all 0.2s',
                        boxShadow: item.done ? `0 2px 8px ${C.mint}55` : 'none',
                      }}
                    >{item.done ? '✓' : ''}</button>

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                        <span style={{
                          fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em',
                          color:c.color, background:c.color+'18',
                          borderRadius:20, padding:'2px 8px',
                        }}>{c.emoji} {c.label}</span>
                      </div>
                      <div style={{
                        fontSize:14, fontWeight:600, color:C.text, lineHeight:1.4,
                        textDecoration: item.done ? 'line-through' : 'none',
                        wordBreak:'break-word',
                      }}>{item.text}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:whoColor(item) }}/>
                        <span style={{ fontSize:10, color:whoColor(item), fontWeight:700 }}>Added by {whoAdded(item)}</span>
                        {item.done && item.done_at && (
                          <span style={{ fontSize:10, color:C.textDim }}>
                            · Done {new Date(item.done_at).toLocaleDateString('en',{month:'short',day:'numeric'})}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button onClick={()=>deleteItem(item.id)} style={{
                      background:'none', border:`1px solid ${C.border}`, borderRadius:8,
                      width:28, height:28, cursor:'pointer', color:C.textDim,
                      fontSize:12, display:'flex', alignItems:'center', justifyContent:'center',
                      flexShrink:0, transition:'all 0.15s',
                    }}
                      onMouseEnter={e=>{ e.currentTarget.style.background=C.rose+'18'; e.currentTarget.style.color=C.rose; e.currentTarget.style.borderColor=C.rose+'55' }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='none'; e.currentTarget.style.color=C.textDim; e.currentTarget.style.borderColor=C.border }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Add modal ── */}
      {showAdd && (
        <div onClick={()=>setShowAdd(false)} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'min(560px,100%)', background:C.surface, borderRadius:'24px 24px 0 0', padding:'20px 20px 32px', boxShadow:'0 -8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:'0 auto 12px' }}/>
              <div style={{ fontFamily:"'Playfair Display'", fontSize:18, color:C.text }}>Add to bucket list ✨</div>
            </div>

            {/* Category */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, marginBottom:8 }}>Category</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {CATS.map(c=>(
                  <button key={c.key} onClick={()=>setCat(c.key)} style={{
                    background:cat===c.key?c.color+'22':'transparent',
                    color:cat===c.key?c.color:C.textMid,
                    border:`1.5px solid ${cat===c.key?c.color+'88':C.border}`,
                    borderRadius:20, padding:'5px 13px', fontSize:12,
                    fontWeight:cat===c.key?700:500, cursor:'pointer', fontFamily:'inherit',
                  }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, marginBottom:8 }}>What do you want to do?</div>
              <input
                autoFocus type="text"
                placeholder="e.g. Watch sunrise at Batu Ferringhi…"
                value={text} onChange={e=>setText(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addItem()}
                style={{ width:'100%', background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'12px 14px', color:C.text, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor=C.peach}
                onBlur={e=>e.target.style.borderColor=C.border}
              />
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:13, fontSize:13, fontWeight:700, color:C.textMid, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={addItem} disabled={saving||!text.trim()} style={{
                flex:2, background:text.trim()?C.mint:C.border, color:'#fff', border:'none',
                borderRadius:14, padding:13, fontSize:14, fontWeight:700, cursor:text.trim()?'pointer':'default',
                fontFamily:'inherit', transition:'all 0.15s',
                boxShadow:text.trim()?`0 4px 16px ${C.mint}44`:'none',
              }}>{saving?'…':'✿ Add to list'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast&&<div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:999, pointerEvents:'none', background:C.mint, color:'#fff', borderRadius:40, padding:'11px 22px', fontSize:13, fontWeight:700, whiteSpace:'nowrap', boxShadow:`0 8px 32px ${C.mint}66` }}>{toast}</div>}
    </div>
  )
}