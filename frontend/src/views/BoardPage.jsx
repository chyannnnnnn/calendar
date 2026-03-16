import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

const NOTE_COLORS = ['#FFF9C4','#FFD6D6','#D6F5E3','#D6E8FF','#EDD6FF','#FFE4CC']
const NOTE_COLORS_DARK = ['#5C5400','#5C1A22','#1A4D32','#1A3358','#3D1A5C','#5C3A1A']
const STICKERS = ['🌸','💕','✨','🌿','🎀','🌙','⭐','🦋','🍓','🎵','🌈','🐱','🌺','🍵','💌','🫶','🌊','🎨','🍰','🐝']

function rand(min, max) { return Math.random() * (max - min) + min }

export default function BoardPage() {
  const { user, partner, partnershipId, isLinked } = useAuth()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const boardRef = useRef(null)
  const fileRef  = useRef(null)
  const dragRef  = useRef(null) // { id, startX, startY, origX, origY, rectW, rectH }

  const [items,    setItems]    = useState([])
  const [selected, setSelected] = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editText, setEditText] = useState('')
  const [toolbar,  setToolbar]  = useState('note') // 'note'|'sticker'|'photo'
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!partnershipId) return
    load()
    const ch = supabase.channel('board-' + partnershipId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard_items',
        filter: `partnership_id=eq.${partnershipId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [partnershipId])

  async function load() {
    const { data } = await supabase.from('whiteboard_items').select('*')
      .eq('partnership_id', partnershipId)
    setItems(data || [])
  }

  async function addNote() {
    const noteColors = mode === 'dark' ? NOTE_COLORS_DARK : NOTE_COLORS
    const item = {
      id: crypto.randomUUID(),
      partnership_id: partnershipId, author_id: user.id,
      type: 'note', content: 'Click to edit…',
      x: rand(5, 55), y: rand(10, 60),
      w: 18, rotation: rand(-3, 3),
      color: noteColors[Math.floor(Math.random() * noteColors.length)],
      font_size: 14,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setItems(p => [...p, item])
    setSelected(item.id)
    setEditId(item.id)
    setEditText('Click to edit…')
    await supabase.from('whiteboard_items').insert(item)
  }

  async function addSticker(emoji) {
    const item = {
      id: crypto.randomUUID(),
      partnership_id: partnershipId, author_id: user.id,
      type: 'sticker', content: emoji,
      x: rand(10, 60), y: rand(10, 60),
      w: 6, rotation: rand(-8, 8),
      color: '', font_size: 40,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setItems(p => [...p, item])
    await supabase.from('whiteboard_items').insert(item)
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = async ev => {
      const item = {
        id: crypto.randomUUID(),
        partnership_id: partnershipId, author_id: user.id,
        type: 'photo', content: ev.target.result,
        x: rand(10, 50), y: rand(10, 50),
        w: 22, rotation: rand(-4, 4),
        color: '', font_size: 14,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setItems(p => [...p, item])
      setSelected(item.id)
      await supabase.from('whiteboard_items').insert(item)
    }
    r.readAsDataURL(file)
  }

  async function saveText(id) {
    setEditId(null)
    const updated = items.map(i => i.id === id ? { ...i, content: editText } : i)
    setItems(updated)
    await supabase.from('whiteboard_items').update({ content: editText, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function deleteItem(id) {
    setItems(p => p.filter(i => i.id !== id))
    setSelected(null)
    await supabase.from('whiteboard_items').delete().eq('id', id)
  }

  async function savePosition(id, x, y) {
    await supabase.from('whiteboard_items').update({ x, y, updated_at: new Date().toISOString() }).eq('id', id)
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function startDrag(e, id) {
    if (editId === id) return
    e.stopPropagation(); e.preventDefault()
    setSelected(id)
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    const item = items.find(i => i.id === id)
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    dragRef.current = { id, startX: cx, startY: cy, origX: item.x, origY: item.y, rectW: rect.width, rectH: rect.height }
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current; if (!d) return
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const newX = Math.max(0, Math.min(90, d.origX + ((cx - d.startX) / d.rectW) * 100))
      const newY = Math.max(0, Math.min(90, d.origY + ((cy - d.startY) / d.rectH) * 100))
      setItems(p => p.map(i => i.id === d.id ? { ...i, x: newX, y: newY } : i))
    }
    function onUp(e) {
      const d = dragRef.current; if (!d) return
      const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
      const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY
      const moved = Math.abs(cx - d.startX) > 4 || Math.abs(cy - d.startY) > 4
      if (moved) {
        const item = items.find(i => i.id === d.id)
        if (item) savePosition(d.id, item.x, item.y)
      }
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
  }, [items])

  const boardBg = mode === 'dark'
    ? '#1C1208'
    : '#F5EDD8'

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text, overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        @keyframes popIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
        .board-item{animation:popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)}
      `}</style>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:52, padding:'0 16px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${C.border}`, background:C.surface, zIndex:10 }}>
        <button onClick={()=>navigate('/')} style={{ background:'none', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:10, padding:'5px 11px', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>← Calendar</button>
        <div style={{ flex:1, textAlign:'center', fontFamily:"'Caveat'", fontSize:22, color:C.text, fontWeight:700 }}>
          🪵 Our Board
        </div>
        <button onClick={toggleTheme} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:10, padding:'5px 10px', cursor:'pointer', fontSize:13, color:C.textMid, fontFamily:'inherit', fontWeight:700 }}>{mode==='light'?'🌙':'☀️'}</button>
      </header>

      {!isLinked && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🪵</div>
          <div style={{ fontFamily:"'Caveat'", fontSize:26, color:C.text, marginBottom:8 }}>Your shared board</div>
          <p style={{ fontSize:14, color:C.textMid, maxWidth:300, lineHeight:1.7, marginBottom:24 }}>Connect with your partner to start decorating your board together.</p>
          <button onClick={()=>navigate('/connect')} style={{ background:C.peach, color:'#fff', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Connect now 💕</button>
        </div>
      )}

      {isLinked && (
        <>
          {/* ── Toolbar ── */}
          <div style={{ flexShrink:0, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', alignItems:'center', gap:8, overflowX:'auto' }}>
            {/* Add note */}
            <button onClick={addNote} style={{ display:'flex', alignItems:'center', gap:6, background:C.gold+'22', border:`1.5px solid ${C.gold}55`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.gold, cursor:'pointer', flexShrink:0 }}>
              📝 Add note
            </button>
            {/* Add photo */}
            <label style={{ display:'flex', alignItems:'center', gap:6, background:C.mint+'22', border:`1.5px solid ${C.mint}55`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.mint, cursor:'pointer', flexShrink:0 }}>
              📷 Add photo
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload}/>
            </label>
            {/* Sticker picker toggle */}
            <button onClick={()=>setToolbar(t => t==='sticker'?'none':'sticker')} style={{ display:'flex', alignItems:'center', gap:6, background: toolbar==='sticker'?C.lavender+'22':'transparent', border:`1.5px solid ${toolbar==='sticker'?C.lavender+'88':C.border}`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color: toolbar==='sticker'?C.lavender:C.textMid, cursor:'pointer', flexShrink:0 }}>
              🎀 Stickers {toolbar==='sticker'?'▲':'▼'}
            </button>
            <div style={{ flex:1 }}/>
            {selected && (
              <button onClick={()=>deleteItem(selected)} style={{ background:C.rose+'18', border:`1px solid ${C.rose}44`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.rose, cursor:'pointer', flexShrink:0 }}>
                🗑 Remove
              </button>
            )}
          </div>

          {/* Sticker tray */}
          {toolbar==='sticker' && (
            <div style={{ flexShrink:0, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', gap:6, overflowX:'auto' }}>
              {STICKERS.map(s => (
                <button key={s} onClick={()=>addSticker(s)} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:'6px', fontSize:22, cursor:'pointer', flexShrink:0, transition:'transform 0.1s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                >{s}</button>
              ))}
            </div>
          )}

          {/* ── Canvas ── */}
          <div
            ref={boardRef}
            onClick={()=>{ setSelected(null); if (editId) saveText(editId) }}
            style={{
              flex:1, position:'relative', overflow:'hidden',
              background: boardBg,
              backgroundImage: mode==='dark'
                ? `radial-gradient(circle at 20% 20%, #2A1F0A22 0%, transparent 60%), radial-gradient(circle at 80% 80%, #1A120522 0%, transparent 60%)`
                : `radial-gradient(circle at 20% 20%, #E8D5A033 0%, transparent 60%), radial-gradient(circle at 80% 80%, #C4A06022 0%, transparent 60%)`,
            }}
          >
            {/* Cork texture dots */}
            <div style={{ position:'absolute', inset:0, opacity: mode==='dark'?0.03:0.06, backgroundImage:`radial-gradient(circle, #5C3A1A 1px, transparent 1px)`, backgroundSize:'24px 24px', pointerEvents:'none' }}/>

            {items.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:C.textDim, textAlign:'center', padding:32, pointerEvents:'none' }}>
                <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>🪵</div>
                <div style={{ fontFamily:"'Caveat'", fontSize:22, marginBottom:6, opacity:0.5 }}>Your board is empty</div>
                <div style={{ fontSize:13, opacity:0.4 }}>Add sticky notes, photos, and stickers above</div>
              </div>
            )}

            {items.map(item => {
              const isSel = selected === item.id
              const isEdit = editId === item.id

              return (
                <div
                  key={item.id}
                  className="board-item"
                  onMouseDown={e => startDrag(e, item.id)}
                  onTouchStart={e => startDrag(e, item.id)}
                  onClick={e => { e.stopPropagation(); setSelected(item.id) }}
                  onDoubleClick={e => {
                    e.stopPropagation()
                    if (item.type === 'note') { setEditId(item.id); setEditText(item.content) }
                  }}
                  style={{
                    position:'absolute',
                    left: `${item.x}%`,
                    top:  `${item.y}%`,
                    width: `${item.w}%`,
                    minWidth: item.type==='sticker' ? 'auto' : 120,
                    transform: `rotate(${item.rotation}deg)`,
                    cursor: dragRef.current?.id === item.id ? 'grabbing' : 'grab',
                    zIndex: isSel ? 50 : 10,
                    userSelect:'none', touchAction:'none',
                    filter: isSel ? `drop-shadow(0 8px 24px rgba(0,0,0,0.3))` : `drop-shadow(0 3px 8px rgba(0,0,0,0.15))`,
                    transition: dragRef.current?.id === item.id ? 'none' : 'filter 0.15s',
                  }}
                >
                  {item.type === 'note' && (
                    <div style={{
                      background: item.color,
                      borderRadius: 4,
                      padding: '12px 12px 20px',
                      minHeight: 80,
                      boxShadow: '2px 4px 12px rgba(0,0,0,0.2)',
                      position:'relative',
                      border: isSel ? `2px solid ${C.peach}` : '2px solid transparent',
                    }}>
                      {/* Pin */}
                      <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', width:12, height:12, borderRadius:'50%', background:C.rose, boxShadow:'0 2px 4px rgba(0,0,0,0.3)', zIndex:1 }}/>
                      {isEdit
                        ? <textarea
                            autoFocus
                            value={editText}
                            onChange={e=>setEditText(e.target.value)}
                            onBlur={()=>saveText(item.id)}
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>e.stopPropagation()}
                            rows={4}
                            style={{
                              width:'100%', background:'transparent', border:'none', outline:'none',
                              fontFamily:"'Caveat'", fontSize:15, color:'#3D2B1F',
                              resize:'none', lineHeight:1.5,
                            }}
                          />
                        : <div style={{ fontFamily:"'Caveat'", fontSize:15, color:'#3D2B1F', lineHeight:1.5, wordBreak:'break-word', whiteSpace:'pre-wrap' }}>
                            {item.content}
                          </div>
                      }
                      {isSel && <div style={{ position:'absolute', bottom:4, right:8, fontSize:9, color:'rgba(61,43,31,0.4)', fontWeight:600 }}>double-tap to edit</div>}
                    </div>
                  )}

                  {item.type === 'sticker' && (
                    <div style={{
                      fontSize: item.font_size || 40, lineHeight:1, textAlign:'center',
                      filter: isSel ? `drop-shadow(0 0 8px ${C.peach}88)` : 'none',
                      padding:4,
                    }}>{item.content}</div>
                  )}

                  {item.type === 'photo' && (
                    <div style={{ position:'relative' }}>
                      <div style={{ background:'#fff', padding:'8px 8px 28px', boxShadow:'2px 4px 12px rgba(0,0,0,0.25)', border: isSel?`2px solid ${C.peach}`:`2px solid rgba(255,255,255,0.8)` }}>
                        <img src={item.content} alt="" style={{ width:'100%', display:'block', objectFit:'cover', maxHeight:200 }} draggable={false}/>
                        <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', width:14, height:14, borderRadius:'50%', background:C.peach, boxShadow:'0 2px 4px rgba(0,0,0,0.3)' }}/>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}