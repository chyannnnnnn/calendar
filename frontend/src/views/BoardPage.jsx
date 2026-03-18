import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const NOTE_PALETTES = {
  light: ['#FFF9C4','#FFD6D6','#D6F5E3','#D6E8FF','#EDD6FF','#FFE4CC','#F5D6FF','#D6F0FF'],
  dark:  ['#4A4200','#4A1520','#0E3D28','#0E2A48','#2E1A4A','#4A2800','#3A1A4A','#0E3040'],
}
const FONTS = [
  { key:'Caveat',           label:'Handwritten', sample:'Aa' },
  { key:'Nunito',           label:'Clean',       sample:'Aa' },
  { key:"'Playfair Display'", label:'Elegant',   sample:'Aa' },
]
const STICKERS = ['🌸','💕','✨','🌿','🎀','🌙','⭐','🦋','🍓','🎵','🌈','🐱','🌺','🍵','💌','🫶','🌊','🎨','🍰','🐝']

// ── Helpers ───────────────────────────────────────────────────────────────────
// Store color and font together in the `color` DB column as "color|font"
function encodeStyle(color, font) { return `${color}|${font}` }
function decodeStyle(encoded) {
  const parts = (encoded || '').split('|')
  return { color: parts[0] || '#FFF9C4', font: parts[1] || 'Caveat' }
}

export default function BoardPage() {
  const { user, partner, partnershipId, isLinked } = useAuth()
  const { C, mode } = useTheme()
  const boardRef = useRef(null)
  const fileRef  = useRef(null)
  const dragRef  = useRef(null)

  const [items,     setItems]     = useState([])
  const [selected,  setSelected]  = useState(null)
  const [editId,    setEditId]    = useState(null)
  const [editText,  setEditText]  = useState('')
  const [showComposer, setShowComposer] = useState(false) // note composer modal
  const [toolbar,   setToolbar]   = useState('none') // 'sticker'
  const [saving,    setSaving]    = useState(false)

  // Composer state
  const [compText,  setCompText]  = useState('')
  const [compColor, setCompColor] = useState(NOTE_PALETTES.light[0])
  const [compFont,  setCompFont]  = useState('Caveat')

  useEffect(() => {
    if (!partnershipId) return
    load()
    const ch = supabase.channel('board-' + partnershipId)
      .on('postgres_changes', { event:'*', schema:'public', table:'whiteboard_items',
        filter:`partnership_id=eq.${partnershipId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [partnershipId])

  // Sync compColor with dark/light mode
  useEffect(() => {
    const palettes = NOTE_PALETTES[mode] || NOTE_PALETTES.light
    const idx = NOTE_PALETTES.light.indexOf(compColor)
    if (idx >= 0) setCompColor(palettes[idx])
  }, [mode])

  async function load() {
    const { data } = await supabase.from('whiteboard_items').select('*')
      .eq('partnership_id', partnershipId)
    setItems(data || [])
  }

  // ── Add note from composer ────────────────────────────────────────────────
  async function commitNote() {
    const item = {
      id: crypto.randomUUID(),
      partnership_id: partnershipId, author_id: user.id,
      type: 'note',
      content: compText || 'Double-tap to edit…',
      x: 5 + Math.random() * 55,
      y: 8 + Math.random() * 55,
      w: 20,
      rotation: (Math.random() - 0.5) * 6,
      color: encodeStyle(compColor, compFont),
      font_size: 15,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setItems(p => [...p, item])
    setSelected(item.id)
    setShowComposer(false)
    setCompText('')
    await supabase.from('whiteboard_items').insert(item)
  }

  // ── Add sticker ───────────────────────────────────────────────────────────
  async function addSticker(emoji) {
    const item = {
      id: crypto.randomUUID(),
      partnership_id: partnershipId, author_id: user.id,
      type: 'sticker', content: emoji,
      x: 10 + Math.random() * 60, y: 10 + Math.random() * 60,
      w: 6, rotation: (Math.random() - 0.5) * 16,
      color: '', font_size: 40,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setItems(p => [...p, item])
    await supabase.from('whiteboard_items').insert(item)
    setToolbar('none')
  }

  // ── Add photo ─────────────────────────────────────────────────────────────
  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = async ev => {
      const item = {
        id: crypto.randomUUID(),
        partnership_id: partnershipId, author_id: user.id,
        type: 'photo', content: ev.target.result,
        x: 10 + Math.random() * 50, y: 10 + Math.random() * 50,
        w: 22, rotation: (Math.random() - 0.5) * 8,
        color: '', font_size: 14,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setItems(p => [...p, item])
      setSelected(item.id)
      await supabase.from('whiteboard_items').insert(item)
    }
    r.readAsDataURL(file)
  }

  // ── Edit text ─────────────────────────────────────────────────────────────
  async function saveText(id) {
    setEditId(null)
    setItems(p => p.map(i => i.id === id ? { ...i, content: editText } : i))
    await supabase.from('whiteboard_items').update({ content: editText, updated_at: new Date().toISOString() }).eq('id', id)
  }

  // ── Update note style (color / font) ─────────────────────────────────────
  async function updateStyle(id, newColor, newFont) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const { color: oldColor, font: oldFont } = decodeStyle(item.color)
    const encoded = encodeStyle(newColor ?? oldColor, newFont ?? oldFont)
    setItems(p => p.map(i => i.id === id ? { ...i, color: encoded } : i))
    await supabase.from('whiteboard_items').update({ color: encoded, updated_at: new Date().toISOString() }).eq('id', id)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteItem(id) {
    setItems(p => p.filter(i => i.id !== id))
    setSelected(null)
    await supabase.from('whiteboard_items').delete().eq('id', id)
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  function startDrag(e, id) {
    if (editId === id) return
    e.stopPropagation(); e.preventDefault()
    setSelected(id)
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    const item = items.find(i => i.id === id)
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    dragRef.current = { id, startX:cx, startY:cy, origX:item.x, origY:item.y, rectW:rect.width, rectH:rect.height }
  }

  async function savePosition(id, x, y) {
    await supabase.from('whiteboard_items').update({ x, y, updated_at: new Date().toISOString() }).eq('id', id)
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current; if (!d) return
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const newX = Math.max(0, Math.min(90, d.origX + ((cx - d.startX) / d.rectW) * 100))
      const newY = Math.max(0, Math.min(90, d.origY + ((cy - d.startY) / d.rectH) * 100))
      setItems(p => p.map(i => i.id === d.id ? { ...i, x:newX, y:newY } : i))
    }
    function onUp(e) {
      const d = dragRef.current; if (!d) return
      const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
      const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY
      const moved = Math.abs(cx-d.startX)>4 || Math.abs(cy-d.startY)>4
      if (moved) {
        const item = items.find(i => i.id === d.id)
        if (item) savePosition(d.id, item.x, item.y)
      }
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive:false })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
  }, [items])

  const selectedItem = items.find(i => i.id === selected)
  const palettes = NOTE_PALETTES[mode] || NOTE_PALETTES.light

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:C.bg, fontFamily:"'Nunito',sans-serif", color:C.text, overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,600&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        @keyframes popIn{from{opacity:0;transform:scale(0.7) rotate(var(--r,0deg))}to{opacity:1;transform:scale(1) rotate(var(--r,0deg))}}
        .board-item{animation:popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)}
      `}</style>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:48, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'center', borderBottom:`1px solid ${C.border}`, background:C.surface, zIndex:10 }}>
        <div style={{ fontFamily:"'Caveat'", fontSize:22, color:C.text, fontWeight:700 }}>🪵 Our Board</div>
      </header>

      {!isLinked ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🪵</div>
          <div style={{ fontFamily:"'Caveat'", fontSize:26, color:C.text, marginBottom:8 }}>Your shared board</div>
          <p style={{ fontSize:14, color:C.textMid, maxWidth:300, lineHeight:1.7, marginBottom:24 }}>Connect with your partner to start decorating your board together.</p>
          <button onClick={()=>window.location.href='/connect'} style={{ background:C.peach, color:'#fff', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Connect now 💕</button>
        </div>
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div style={{ flexShrink:0, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', alignItems:'center', gap:8, overflowX:'auto' }}>
            <button onClick={()=>{ setCompText(''); setShowComposer(true) }} style={{ display:'flex', alignItems:'center', gap:6, background:C.gold+'22', border:`1.5px solid ${C.gold}55`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.gold, cursor:'pointer', flexShrink:0 }}>
              📝 Add note
            </button>
            <label style={{ display:'flex', alignItems:'center', gap:6, background:C.mint+'22', border:`1.5px solid ${C.mint}55`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.mint, cursor:'pointer', flexShrink:0 }}>
              📷 Add photo
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload}/>
            </label>
            <button onClick={()=>setToolbar(t=>t==='sticker'?'none':'sticker')} style={{ display:'flex', alignItems:'center', gap:6, background:toolbar==='sticker'?C.lavender+'22':'transparent', border:`1.5px solid ${toolbar==='sticker'?C.lavender+'88':C.border}`, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:toolbar==='sticker'?C.lavender:C.textMid, cursor:'pointer', flexShrink:0 }}>
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

          {/* ── Selected note style bar ── */}
          {selectedItem?.type === 'note' && (
            <div style={{ flexShrink:0, padding:'6px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', alignItems:'center', gap:10, overflowX:'auto' }}>
              <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, flexShrink:0 }}>Style</span>
              {/* Color swatches */}
              {palettes.map((col, i) => {
                const { color: curColor } = decodeStyle(selectedItem.color)
                const isActive = curColor === col
                return (
                  <button key={col} onClick={()=>updateStyle(selected, col, null)} style={{
                    width:20, height:20, borderRadius:'50%', background:col, flexShrink:0,
                    border: isActive ? `2.5px solid ${C.peach}` : `1.5px solid ${C.border}`,
                    cursor:'pointer', transition:'transform 0.1s',
                    transform: isActive ? 'scale(1.25)' : 'scale(1)',
                    boxSizing:'border-box',
                  }}/>
                )
              })}
              <div style={{ width:1, height:20, background:C.border, flexShrink:0 }}/>
              {/* Font buttons */}
              {FONTS.map(f => {
                const { font: curFont } = decodeStyle(selectedItem.color)
                const isActive = curFont === f.key
                return (
                  <button key={f.key} onClick={()=>updateStyle(selected, null, f.key)} style={{
                    background: isActive ? C.peach+'22' : 'transparent',
                    border:`1.5px solid ${isActive ? C.peach+'88' : C.border}`,
                    borderRadius:8, padding:'3px 10px', cursor:'pointer',
                    fontSize:12, fontFamily:f.key, fontWeight:700,
                    color: isActive ? C.peach : C.textMid,
                    flexShrink:0, transition:'all 0.12s',
                  }}>{f.sample} {f.label}</button>
                )
              })}
            </div>
          )}

          {/* ── Canvas ── */}
          <div
            ref={boardRef}
            onClick={()=>{ setSelected(null); if(editId) saveText(editId) }}
            style={{
              flex:1, position:'relative', overflow:'hidden',
              background: mode==='dark' ? '#1C1208' : '#F5EDD8',
              backgroundImage: mode==='dark'
                ? 'radial-gradient(circle at 20% 20%, #2A1F0A22 0%,transparent 60%), radial-gradient(circle at 80% 80%, #1A120522 0%,transparent 60%)'
                : 'radial-gradient(circle at 20% 20%, #E8D5A033 0%,transparent 60%), radial-gradient(circle at 80% 80%, #C4A06022 0%,transparent 60%)',
            }}
          >
            {/* Cork dots */}
            <div style={{ position:'absolute', inset:0, opacity:mode==='dark'?0.03:0.06, backgroundImage:'radial-gradient(circle, #5C3A1A 1px, transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }}/>

            {items.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:C.textDim, textAlign:'center', padding:32, pointerEvents:'none' }}>
                <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>🪵</div>
                <div style={{ fontFamily:"'Caveat'", fontSize:22, marginBottom:6, opacity:0.5 }}>Your board is empty</div>
                <div style={{ fontSize:13, opacity:0.4 }}>Add sticky notes, photos, and stickers above</div>
              </div>
            )}

            {items.map(item => {
              const isSel  = selected === item.id
              const isEdit = editId   === item.id
              const { color: noteColor, font: noteFont } = decodeStyle(item.color)

              return (
                <div
                  key={item.id}
                  className="board-item"
                  onMouseDown={e=>startDrag(e,item.id)}
                  onTouchStart={e=>startDrag(e,item.id)}
                  onClick={e=>{e.stopPropagation();setSelected(item.id)}}
                  onDoubleClick={e=>{
                    e.stopPropagation()
                    if(item.type==='note'){setEditId(item.id);setEditText(item.content)}
                  }}
                  style={{
                    position:'absolute', left:`${item.x}%`, top:`${item.y}%`,
                    width: item.type==='sticker'?'auto':`${item.w}%`,
                    minWidth: item.type==='sticker'?'auto':120,
                    transform:`rotate(${item.rotation}deg)`,
                    cursor: dragRef.current?.id===item.id?'grabbing':'grab',
                    zIndex: isSel?50:10,
                    userSelect:'none', touchAction:'none',
                    filter: isSel?'drop-shadow(0 8px 24px rgba(0,0,0,0.3))':'drop-shadow(0 3px 8px rgba(0,0,0,0.15))',
                    transition: dragRef.current?.id===item.id?'none':'filter 0.15s',
                  }}
                >
                  {item.type === 'note' && (
                    <div style={{
                      background: noteColor,
                      borderRadius:4, padding:'12px 12px 20px', minHeight:80,
                      boxShadow:'2px 4px 12px rgba(0,0,0,0.2)', position:'relative',
                      border: isSel?`2px solid ${C.peach}`:'2px solid transparent',
                    }}>
                      {/* Pin */}
                      <div style={{ position:'absolute', top:-7, left:'50%', transform:'translateX(-50%)', width:13, height:13, borderRadius:'50%', background:C.rose, boxShadow:'0 2px 6px rgba(0,0,0,0.35)', zIndex:1 }}/>
                      {isEdit
                        ? <textarea autoFocus value={editText}
                            onChange={e=>setEditText(e.target.value)}
                            onBlur={()=>saveText(item.id)}
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>e.stopPropagation()}
                            rows={4}
                            style={{ width:'100%', background:'transparent', border:'none', outline:'none', fontFamily:noteFont, fontSize:15, color:'#3D2B1F', resize:'none', lineHeight:1.55 }}
                          />
                        : <div style={{ fontFamily:noteFont, fontSize:15, color:'#3D2B1F', lineHeight:1.55, wordBreak:'break-word', whiteSpace:'pre-wrap' }}>
                            {item.content}
                          </div>
                      }
                      {isSel && <div style={{ position:'absolute', bottom:4, right:8, fontSize:9, color:'rgba(61,43,31,0.35)', fontWeight:600 }}>dbl-tap to edit</div>}
                    </div>
                  )}

                  {item.type === 'sticker' && (
                    <div style={{ fontSize:item.font_size||40, lineHeight:1, textAlign:'center', filter:isSel?`drop-shadow(0 0 8px ${C.peach}88)`:'none', padding:4 }}>
                      {item.content}
                    </div>
                  )}

                  {item.type === 'photo' && (
                    <div style={{ position:'relative' }}>
                      <div style={{ background:'#fff', padding:'8px 8px 28px', boxShadow:'2px 4px 12px rgba(0,0,0,0.25)', border:isSel?`2px solid ${C.peach}`:`2px solid rgba(255,255,255,0.8)` }}>
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

      {/* ══ Note Composer Modal ══════════════════════════════════════════════ */}
      {showComposer && (
        <div onClick={()=>setShowComposer(false)} style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'min(440px,100%)', background:C.surface, borderRadius:22, boxShadow:'0 24px 64px rgba(0,0,0,0.3)', overflow:'hidden' }}>

            {/* Preview */}
            <div style={{ padding:'20px 20px 12px', background: mode==='dark'?'#1C1208':'#F5EDD8', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'center' }}>
              <div style={{
                background:compColor, borderRadius:4, padding:'14px 14px 22px', width:'75%', minHeight:90,
                boxShadow:'3px 5px 16px rgba(0,0,0,0.2)', position:'relative', transform:'rotate(-1.5deg)',
              }}>
                <div style={{ position:'absolute', top:-7, left:'50%', transform:'translateX(-50%)', width:12, height:12, borderRadius:'50%', background:C.rose, boxShadow:'0 2px 4px rgba(0,0,0,0.3)' }}/>
                <div style={{ fontFamily:compFont, fontSize:15, color:'#3D2B1F', lineHeight:1.55, minHeight:40, opacity:compText?1:0.4 }}>
                  {compText || 'Your note will look like this…'}
                </div>
              </div>
            </div>

            <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:14 }}>

              {/* Text input */}
              <div>
                <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, marginBottom:7 }}>✍️ Text (optional)</div>
                <textarea
                  autoFocus
                  placeholder="Type something, or leave empty to write on the board…"
                  value={compText}
                  onChange={e=>setCompText(e.target.value)}
                  rows={3}
                  style={{ width:'100%', background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', fontFamily:compFont, lineHeight:1.6, boxSizing:'border-box', resize:'none' }}
                  onFocus={e=>e.target.style.borderColor=C.peach}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>

              {/* Colour picker */}
              <div>
                <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, marginBottom:8 }}>🎨 Colour</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {palettes.map(col => (
                    <button key={col} onClick={()=>setCompColor(col)} style={{
                      width:28, height:28, borderRadius:'50%', background:col,
                      border: compColor===col ? `3px solid ${C.peach}` : `1.5px solid ${C.border}`,
                      cursor:'pointer', transition:'all 0.12s', boxSizing:'border-box',
                      transform: compColor===col ? 'scale(1.2)' : 'scale(1)',
                    }}/>
                  ))}
                </div>
              </div>

              {/* Font picker */}
              <div>
                <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.textDim, marginBottom:8 }}>✏️ Font style</div>
                <div style={{ display:'flex', gap:8 }}>
                  {FONTS.map(f => (
                    <button key={f.key} onClick={()=>setCompFont(f.key)} style={{
                      flex:1, padding:'10px 8px', borderRadius:12, cursor:'pointer',
                      background: compFont===f.key ? C.peach+'20' : C.bg,
                      border:`1.5px solid ${compFont===f.key ? C.peach+'88' : C.border}`,
                      transition:'all 0.12s',
                    }}>
                      <div style={{ fontFamily:f.key, fontSize:18, color:compFont===f.key?C.peach:C.text, marginBottom:3, fontWeight:600 }}>Aa</div>
                      <div style={{ fontSize:10, fontWeight:700, color:compFont===f.key?C.peach:C.textDim }}>{f.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, marginTop:2 }}>
                <button onClick={()=>setShowComposer(false)} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:12, fontSize:13, fontWeight:700, color:C.textMid, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button onClick={commitNote} style={{ flex:2, background:C.gold, color:'#fff', border:'none', borderRadius:12, padding:12, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 16px ${C.gold}44` }}>
                  📝 Place note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}