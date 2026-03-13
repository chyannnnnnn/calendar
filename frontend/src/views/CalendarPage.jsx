import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useCalendar } from '../hooks/useCalendar'
import { useTheme } from '../lib/ThemeContext'
import LocationPicker from '../components/LocationPicker'
import CompareView from '../components/CompareView'
import { fetchStickersForCouple, upsertSticker, deleteSticker as deleteRemoteSticker, subscribeToStickers } from '../lib/stickers'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']


// Parse location stored in DB — could be JSON {name,lat,lng} or a plain string (legacy)
function parseLocation(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return { name: raw, lat: null, lng: null } }
}
// Serialize location to store in DB
function serializeLocation(loc) {
  if (!loc) return ''
  return JSON.stringify(loc)
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function timeToMins(t) { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m }
function minsToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}` }

function getWeekDates(base) {
  const d=new Date(base), start=new Date(d)
  start.setDate(d.getDate()-d.getDay())
  return Array.from({length:7},(_,i)=>{ const nd=new Date(start); nd.setDate(start.getDate()+i); return nd })
}

function getMonthDates(base) {
  const year=base.getFullYear(), month=base.getMonth()
  const first=new Date(year,month,1), last=new Date(year,month+1,0)
  const dates=[]
  for(let i=first.getDay();i>0;i--) dates.push({date:new Date(year,month,1-i),inMonth:false})
  for(let i=1;i<=last.getDate();i++) dates.push({date:new Date(year,month,i),inMonth:true})
  for(let i=1;i<=6-last.getDay();i++) dates.push({date:new Date(year,month+1,i),inMonth:false})
  return dates
}

const HOUR_ROWS = Array.from({length:16},(_,i)=>i+7)


// ─── Calendar Sticker system ─────────────────────────────────────────────────
// Stickers are tied to a specific date and stored in Supabase so both partners
// see them. They only appear in Month view on the date cell they belong to.
// Shape: { id, date, type:'emoji'|'image', value, x, y, size }
// x/y = % offset within that date cell. size = px.

// ─── Floating background doodles ─────────────────────────────────────────────
const DOODLES = [
  { id:'h1', x:'6%',  y:'10%', size:22, rotate:'-15deg', dur:'7s',  delay:'0s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14 14 21 12 21Z" fill="#D4607A22" stroke="#D4607A55" strokeWidth="1.5"/></svg> },
  { id:'s1', x:'87%', y:'7%',  size:18, rotate:'20deg',  dur:'9s',  delay:'1s',
    svg:<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#D4920A22" stroke="#D4920A55" strokeWidth="1"/></svg> },
  { id:'m1', x:'4%',  y:'52%', size:24, rotate:'10deg',  dur:'11s', delay:'2s',
    svg:<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="#8B72BE22" stroke="#8B72BE44" strokeWidth="1.5"/></svg> },
  { id:'f1', x:'91%', y:'42%', size:26, rotate:'-20deg', dur:'8s',  delay:'0.5s',
    svg:<svg viewBox="0 0 32 32"><circle cx="16" cy="10" r="4" fill="#E8787022"/><circle cx="22" cy="14" r="4" fill="#E8787022"/><circle cx="22" cy="21" r="4" fill="#E8787022"/><circle cx="16" cy="25" r="4" fill="#E8787022"/><circle cx="10" cy="21" r="4" fill="#E8787022"/><circle cx="10" cy="14" r="4" fill="#E8787022"/><circle cx="16" cy="17" r="5" fill="#D4920A33"/></svg> },
  { id:'sp1',x:'48%', y:'3%',  size:20, rotate:'0deg',   dur:'6s',  delay:'1.5s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#4BAF8444" strokeWidth="2" strokeLinecap="round"/></svg> },
  { id:'h2', x:'74%', y:'73%', size:16, rotate:'12deg',  dur:'10s', delay:'3s',
    svg:<svg viewBox="0 0 24 24"><path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14 14 21 12 21Z" fill="#D4607A18" stroke="#D4607A33" strokeWidth="1"/></svg> },
  { id:'c1', x:'18%', y:'80%', size:32, rotate:'-5deg',  dur:'13s', delay:'4s',
    svg:<svg viewBox="0 0 40 24"><path d="M32 20H10C6.13 20 3 16.87 3 13s3.13-7 7-7c.34 0 .67.03 1 .07C12.29 3.93 15.39 2 19 2c4.97 0 9 4.03 9 9h1c2.76 0 5 2.24 5 5s-2.24 5-5 5z" fill="#8B72BE18" stroke="#8B72BE33" strokeWidth="1"/></svg> },
  { id:'dot1',x:'60%',y:'88%', size:10, rotate:'0deg',   dur:'5s',  delay:'2.5s',
    svg:<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#D4607A33"/></svg> },
  { id:'dot2',x:'32%',y:'6%',  size:8,  rotate:'0deg',   dur:'7s',  delay:'3.5s',
    svg:<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#D4920A33"/></svg> },
]

function FloatingDoodles() {
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0px) rotate(var(--rot)); }
          50%      { transform: translateY(-10px) rotate(calc(var(--rot) + 4deg)); }
        }
        @keyframes pulse-soft {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 0.9; }
        }
        .doodle { animation: float var(--dur) ease-in-out var(--delay) infinite, pulse-soft calc(var(--dur) * 1.4) ease-in-out infinite; }
      `}</style>
      {DOODLES.map(d=>(
        <div key={d.id} className="doodle" style={{
          position:'absolute', left:d.x, top:d.y,
          width:d.size, height:d.size,
          '--rot': d.rotate, '--dur': d.dur, '--delay': d.delay,
        }}>
          {d.svg}
        </div>
      ))}
    </div>
  )
}

// ─── Sticker Tray ─────────────────────────────────────────────────────────────
const PRESET_STICKERS = ['🌸','💕','🌿','✨','🍀','🌻','🎀','🫧','🍓','🧸','🌈','🎠','🦋','🍵','🌙','⭐','🫶','🎪','🌺','🍡','🐝','🌷','🦄','🍒','🎵','🌊','🍑','🐱','🎨','🍰']

function StickerTray({ onAdd, onClose, C, isMobile, date }) {
  const [tab, setTab] = React.useState('emoji') // 'emoji' | 'upload'
  const [uploads, setUploads] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('uscal_custom_stickers') || '[]') } catch { return [] }
  })

  function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const val = ev.target.result
      const updated = [...uploads, val].slice(-20) // keep last 20
      setUploads(updated)
      try { localStorage.setItem('uscal_custom_stickers', JSON.stringify(updated)) } catch {}
      onAdd({ type:'image', value:val })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.border}`,
      borderRadius:20, padding:'16px 18px',
      width: isMobile ? 'calc(100vw - 24px)' : 320,
      maxHeight: isMobile ? '60vh' : '70vh',
      overflowY:'auto',
      boxShadow:`0 16px 48px rgba(0,0,0,0.25)`,
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{fontFamily:"'Playfair Display'",fontSize:17,color:C.text,fontWeight:600}}>
          🎀 {date ? `${new Date(date+'T00:00').toLocaleDateString('en',{month:'short',day:'numeric'})}` : 'Sticker Tray'}
        </div>
        <div style={{display:'flex',gap:4}}>
          <div style={{display:'flex',background:C.bg,border:`1px solid ${C.border}`,borderRadius:20,padding:2}}>
            {[['emoji','😊'],['upload','🖼️']].map(([t,icon])=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                background:tab===t?C.peach:'transparent', color:tab===t?'#fff':C.textDim,
                border:'none',borderRadius:18,padding:'4px 12px',fontSize:11,
                cursor:'pointer',fontWeight:tab===t?700:400,transition:'all 0.15s',
              }}>{icon} {t}</button>
            ))}
          </div>
          <button onClick={onClose} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,width:28,height:28,cursor:'pointer',color:C.textDim,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>
        {tab==='emoji' ? 'Click to place on canvas. Then drag & resize.' : 'Upload your own sticker images.'}
      </div>

      {tab==='emoji' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5}}>
          {PRESET_STICKERS.map(s=>(
            <button key={s} onClick={()=>onAdd({type:'emoji',value:s})} style={{
              background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,
              padding:'7px 0',fontSize:20,cursor:'pointer',
              transition:'transform 0.1s',
            }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
            >{s}</button>
          ))}
        </div>
      )}

      {tab==='upload' && (
        <div>
          <label style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            background:C.bg,border:`2px dashed ${C.border}`,borderRadius:12,
            padding:'16px',cursor:'pointer',fontSize:12,color:C.textMid,fontWeight:600,marginBottom:10,
          }}>
            <span style={{fontSize:20}}>＋</span> Upload image sticker
            <input type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload}/>
          </label>
          {uploads.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
              {uploads.map((src,i)=>(
                <button key={i} onClick={()=>onAdd({type:'image',value:src})} style={{
                  background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,
                  padding:3,cursor:'pointer',aspectRatio:'1',overflow:'hidden',
                }}>
                  <img src={src} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:5}}/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Canvas Sticker Layer ──────────────────────────────────────────────────────
// Design principles:
//   • All drag/resize state is LOCAL (useState) — React renders smoothly each frame
//   • onChange (Supabase save) only fires on pointerUp, not every pixel
//   • containerRef rect is captured once at drag START, not recalculated every move
//   • Resize uses a large 44px touch target, not a tiny 26px dot
//   • Controls render in a fixed portal-like position so they never get clipped
function CanvasStickerLayer({ stickers, onChange, onDelete, C }) {
  const containerRef = React.useRef(null)

  // Local display state — tracks live position/size while dragging
  // Shape: { id, x, y, size } — only set while a gesture is active
  const [live, setLive]         = React.useState(null)
  const [selected, setSelected] = React.useState(null)
  const gestureRef = React.useRef(null)
  // gestureRef shape:
  //   drag:   { mode:'drag',   id, startX, startY, origX, origY, rectW, rectH }
  //   resize: { mode:'resize', id, startX, startY, origSize }
  //   pinch:  { mode:'pinch',  id, origDist, origSize }

  // ── Unified pointer move ─────────────────────────────────────────────────────
  function applyMove(cx, cy) {
    const g = gestureRef.current
    if (!g) return
    if (g.mode === 'drag') {
      const newX = Math.max(2, Math.min(88, g.origX + ((cx - g.startX) / g.rectW) * 100))
      const newY = Math.max(2, Math.min(88, g.origY + ((cy - g.startY) / g.rectH) * 100))
      setLive({ id: g.id, x: newX, y: newY, size: null })
    }
    if (g.mode === 'resize') {
      // Use largest of dx/dy so both horizontal and vertical drags work
      const dx = cx - g.startX
      const dy = cy - g.startY
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      const newSize = Math.max(20, Math.min(200, g.origSize + delta))
      setLive({ id: g.id, x: null, y: null, size: newSize })
    }
  }

  function commitGesture() {
    const g = gestureRef.current
    if (!g || !live) { gestureRef.current = null; setLive(null); return }
    // Build updated list and fire onChange ONCE (triggers Supabase save)
    const updated = stickers.map(s => {
      if (s.id !== g.id) return s
      if (g.mode === 'drag')   return { ...s, x: live.x,    y: live.y }
      if (g.mode === 'resize') return { ...s, size: live.size }
      return s
    })
    gestureRef.current = null
    setLive(null)
    onChange(updated)
  }

  // ── Global listeners — registered once ───────────────────────────────────────
  React.useEffect(() => {
    function onMouseMove(e) { applyMove(e.clientX, e.clientY) }
    function onMouseUp()    { commitGesture() }
    function onTouchMove(e) {
      const g = gestureRef.current
      if (!g) return
      if (g.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx*dx + dy*dy)
        const newSize = Math.max(20, Math.min(200, g.origSize * (dist / g.origDist)))
        setLive({ id: g.id, x: null, y: null, size: newSize })
        return
      }
      if (e.touches.length === 1) applyMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    function onTouchEnd() { commitGesture() }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend',  onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend',  onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickers, live])  // re-bind when stickers/live change so commitGesture closes over latest values

  // ── Start helpers ─────────────────────────────────────────────────────────────
  function startDrag(e, id) {
    e.stopPropagation(); e.preventDefault()
    setSelected(id)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const s = stickers.find(s => s.id === id)
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    gestureRef.current = { mode:'drag', id, startX:cx, startY:cy, origX:s.x, origY:s.y, rectW:rect.width, rectH:rect.height }
  }

  function startResize(e, id) {
    e.stopPropagation(); e.preventDefault()
    const s = stickers.find(s => s.id === id)
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    gestureRef.current = { mode:'resize', id, startX:cx, startY:cy, origSize:s.size }
  }

  function startPinch(e, id) {
    e.stopPropagation()
    if (e.touches.length < 2) return
    const s = stickers.find(s => s.id === id)
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    gestureRef.current = { mode:'pinch', id, origDist: Math.sqrt(dx*dx+dy*dy), origSize: s.size }
  }

  function handleDelete(e, id) {
    e.stopPropagation(); e.preventDefault()
    onDelete ? onDelete(id) : onChange(stickers.filter(s => s.id !== id))
    setSelected(null)
  }

  function handleSetSize(e, id, px) {
    e.stopPropagation()
    onChange(stickers.map(s => s.id === id ? { ...s, size: px } : s))
  }

  const SIZES = [24, 40, 64, 96, 128]

  return (
    <div ref={containerRef}
      style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:20, overflow:'visible' }}
      onMouseDown={e => { if (e.target === containerRef.current) setSelected(null) }}
    >
      {stickers.map(s => {
        const isSel  = selected === s.id
        const isLive = live?.id === s.id
        // While dragging/resizing, show local live values instead of saved props
        const dispX    = (isLive && live.x    != null) ? live.x    : s.x
        const dispY    = (isLive && live.y    != null) ? live.y    : s.y
        const dispSize = (isLive && live.size != null) ? live.size : s.size
        const sz       = Math.round(dispSize)

        return (
          <div key={s.id}
            style={{
              position:   'absolute',
              left:       `${dispX}%`,
              top:        `${dispY}%`,
              width:      sz,
              height:     sz,
              pointerEvents: 'auto',
              userSelect: 'none',
              touchAction:'none',
              zIndex:     isSel ? 30 : 21,
              // No CSS transition during gesture — instant response
              transition: isLive ? 'none' : 'filter 0.12s',
              filter:     isSel
                ? 'drop-shadow(0 4px 16px rgba(0,0,0,0.35))'
                : 'drop-shadow(0 1px 4px rgba(0,0,0,0.12))',
              cursor: gestureRef.current?.id === s.id ? 'grabbing' : (isSel ? 'grab' : 'pointer'),
              overflow: 'visible',
            }}
            onMouseDown={e => startDrag(e, s.id)}
            onTouchStart={e => {
              setSelected(s.id)
              if (e.touches.length >= 2) startPinch(e, s.id)
              else startDrag(e, s.id)
            }}
          >
            {/* ── Sticker content ── */}
            {s.type === 'emoji'
              ? <span style={{ fontSize: sz * 0.85, lineHeight:1, display:'block', textAlign:'center', pointerEvents:'none', userSelect:'none' }}>{s.value}</span>
              : <img src={s.value} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', pointerEvents:'none' }}/>
            }

            {/* ── Selection ring ── */}
            {isSel && <div style={{ position:'absolute', inset:-5, border:`2px dashed ${C.peach}bb`, borderRadius:12, pointerEvents:'none' }}/>}

            {/* ── Controls — only when selected ── */}
            {isSel && <>

              {/* ✕ Delete — top-left, large hit target */}
              <div
                onMouseDown={e => handleDelete(e, s.id)}
                onTouchEnd={e  => handleDelete(e, s.id)}
                style={{
                  position:'absolute', top:-16, left:-16,
                  width:32, height:32, borderRadius:'50%',
                  background:'#E04545', color:'#fff',
                  fontSize:14, fontWeight:900, lineHeight:'32px', textAlign:'center',
                  cursor:'pointer', boxShadow:'0 3px 10px rgba(0,0,0,0.35)',
                  zIndex:34, userSelect:'none', touchAction:'none',
                }}>✕</div>

              {/* ⤡ Resize — bottom-right, 44px hit target for easy grabbing */}
              <div
                onMouseDown={e => startResize(e, s.id)}
                onTouchStart={e => startResize(e, s.id)}
                style={{
                  position:'absolute', bottom:-18, right:-18,
                  width:36, height:36, borderRadius:'50%',
                  background:C.peach, cursor:'nwse-resize',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 3px 10px rgba(0,0,0,0.3)',
                  zIndex:34, touchAction:'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 12L12 2M8 12L12 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Quick-size pill — above the sticker */}
              <div
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                style={{
                  position:'absolute', bottom: sz + 12, left:'50%', transform:'translateX(-50%)',
                  display:'flex', gap:3, background:C.surface,
                  border:`1.5px solid ${C.border}`, borderRadius:24,
                  padding:'5px 10px', boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
                  zIndex:34, whiteSpace:'nowrap',
                }}>
                {SIZES.map(px => (
                  <button key={px}
                    onMouseDown={e => handleSetSize(e, s.id, px)}
                    onTouchEnd={e  => handleSetSize(e, s.id, px)}
                    style={{
                      background: Math.abs(sz-px) < 6 ? C.peach : C.bg,
                      color:      Math.abs(sz-px) < 6 ? '#fff'  : C.textMid,
                      border: `1px solid ${Math.abs(sz-px) < 6 ? C.peach : C.border}`,
                      borderRadius:14, padding:'4px 8px', fontSize:10,
                      fontWeight:700, cursor:'pointer', fontFamily:'inherit', minWidth:30,
                    }}
                  >{px}</button>
                ))}
              </div>

            </>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user, partner, partnershipId, signOut, isLinked, unlinkPartner } = useAuth()
  const navigate = useNavigate()
  const { events, eventsForDate, findFreeSlots, createEvent, removeEvent, removeEventSeries, updateEvent, syncStatus } = useCalendar()
  const { C, mode, toggle: toggleTheme } = useTheme()
  const USER_COLORS = { you:{ color:C.mint }, partner:{ color:C.rose }, ours:{ color:C.lavender } }

  const today    = new Date()
  const todayStr = toDateStr(today)

  const [calView,  setCalView]  = useState('week')
  const [navDate,  setNavDate]  = useState(new Date())
  const [tab,      setTab]      = useState('calendar')
  const [addForm,  setAddForm]  = useState({ title:'', date:'', startTime:'', endTime:'', isPrivate:false, recurring:'none', recurUntil:'', eventType:'mine', location:null, notes:'' })
  const [conflict, setConflict] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editForm, setEditForm] = useState(null)
  // ── Date-attached stickers (synced to Supabase, shared with partner) ──────
  const [calStickers, setCalStickers] = useState([])   // [{ id, date, type, value, x, y, size }]
  const [stickerMode, setStickerMode] = useState(false)          // true = sticker edit mode active
  const [stickerTargetDate, setStickerTargetDate] = useState(null) // which date cell tray is open on

  function enterStickerMode()  { setStickerMode(true); setStickerTargetDate(null) }
  function exitStickerMode()   { setStickerMode(false); setStickerTargetDate(null) }

  // Load stickers from Supabase when partnership is known
  React.useEffect(() => {
    if (!partnershipId) return
    fetchStickersForCouple(partnershipId).then(rows => {
      setCalStickers(rows.map(r => ({
        id: r.id, date: r.date,
        type: r.sticker_type, value: r.sticker_value,
        x: r.x, y: r.y, size: r.size,
      })))
    })
    // Subscribe to real-time updates from partner
    const unsub = subscribeToStickers(partnershipId, () => {
      fetchStickersForCouple(partnershipId).then(rows => {
        setCalStickers(rows.map(r => ({
          id: r.id, date: r.date,
          type: r.sticker_type, value: r.sticker_value,
          x: r.x, y: r.y, size: r.size,
        })))
      })
    })
    return unsub
  }, [partnershipId])

  async function addDateSticker(stickerDef, date) {
    const id = crypto.randomUUID()
    const s = {
      id, date,
      type:  stickerDef.type,
      value: stickerDef.value,
      x: 10 + Math.random() * 60,
      y: 20 + Math.random() * 50,
      size: 36,
    }
    setCalStickers(prev => [...prev, s])
    setStickerTargetDate(null)
    // stay in stickerMode so user can add more stickers to other dates
    if (partnershipId) await upsertSticker(s, user.id, partnershipId)
  }

  async function updateDateStickers(list) {
    // Find which stickers changed vs current state and only save those
    const changed = list.filter(s => {
      const prev = calStickers.find(p => p.id === s.id)
      return !prev || prev.x !== s.x || prev.y !== s.y || prev.size !== s.size
    })
    setCalStickers(list)
    if (!partnershipId) return
    for (const s of changed) {
      await upsertSticker(s, user.id, partnershipId)
    }
  }

  async function removeDateSticker(id) {
    setCalStickers(prev => prev.filter(s => s.id !== id))
    if (partnershipId) await deleteRemoteSticker(id)
  }
  const [confirmDelete, setConfirmDelete] = useState(null) // eventId pending quick-delete confirm
  const [seriesDeleteModal, setSeriesDeleteModal] = useState(null) // event with series_id pending delete choice
  const [menuOpen, setMenuOpen] = useState(false) // mobile hamburger menu
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState(null) // {msg, type: 'success'|'error'}

  function showToast(msg, type='success') {
    setToast({msg, type})
    setTimeout(() => setToast(null), 3500)
  }

  // Responsive: detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useState(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  })

  const weekDates  = getWeekDates(navDate)
  const monthDates = getMonthDates(navDate)
  const navDateStr = toDateStr(navDate)

  function navCal(dir) {
    const d = new Date(navDate)
    if (calView==='day')   d.setDate(d.getDate()+dir)
    else if (calView==='week') d.setDate(d.getDate()+dir*7)
    else d.setMonth(d.getMonth()+dir)
    setNavDate(d)
  }

  function goToDay(date) { setNavDate(new Date(date)); setCalView('day'); setTab('calendar') }

  function ownerOf(ev) {
    if (!user) return 'partner'
    return ev.owner_id === user.id ? 'you' : 'partner'
  }

  function eventColor(ev) {
    if (ev.event_type === 'ours' || ev.title?.startsWith('💑')) return USER_COLORS.ours.color
    return USER_COLORS[ownerOf(ev)].color
  }

  function eventLabel(ev) {
    if (ev.is_private && ownerOf(ev) === 'partner') return '🔒 Busy'
    return ev.title
  }

  function canEdit(ev) {
    return ownerOf(ev) === 'you' || ev.event_type === 'ours'
  }

  function openEdit(ev) {
    setEditForm({
      title:     ev.title?.replace(/^💑\s?/, '') || '',
      date:      ev.date || '',
      startTime: ev.start_time || '',
      endTime:   ev.end_time || '',
      location:  parseLocation(ev.location),
      notes:     ev.notes || '',
      isPrivate: ev.is_private || false,
    })
  }

  async function handleSaveEdit() {
    if (!editForm.title || !editForm.date || !editForm.startTime || !editForm.endTime) return
    setSaving(true)
    try {
      const isOurs = selectedEvent.event_type === 'ours' || selectedEvent.title?.startsWith('💑')
      const changes = {
        title:      isOurs ? `💑 ${editForm.title}` : editForm.title,
        date:       editForm.date,
        start_time: editForm.startTime,
        end_time:   editForm.endTime,
        location:   serializeLocation(editForm.location),
        notes:      editForm.notes,
        is_private: editForm.isPrivate,
      }
      const updated = await updateEvent(selectedEvent.id, changes)
      // Update modal state immediately so UI reflects the save
      setSelectedEvent(updated)
      setEditForm(null)
    } catch (err) {
      console.error('[edit] save failed:', err.message)
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setSelectedEvent(null)
    setEditForm(null)
  }

  // sticker system moved to canvas layer

  function canDelete(ev) {
    // Owner can always delete their own events
    // Either side can delete a shared "ours" event
    return ownerOf(ev) === 'you' || ev.event_type === 'ours'
  }

  async function handleDelete(ev) {
    // If event belongs to a series, ask whether to delete just this one or the whole series
    if (ev.series_id) {
      setSelectedEvent(null)
      setConfirmDelete(null)
      setSeriesDeleteModal(ev)
      return
    }
    setSelectedEvent(null)
    setConfirmDelete(null)
    await removeEvent(ev.id)
  }

  async function handleDeleteOne(ev) {
    setSeriesDeleteModal(null)
    await removeEvent(ev.id)
  }

  async function handleDeleteSeries(ev) {
    setSeriesDeleteModal(null)
    await removeEventSeries(ev.series_id)
  }

  function quickDelete(e, ev) {
    e.stopPropagation()
    if (ev.series_id) {
      // For series events skip the two-tap confirm and go straight to the series modal
      setSeriesDeleteModal(ev)
      return
    }
    if (confirmDelete === ev.id) {
      handleDelete(ev)
    } else {
      setConfirmDelete(ev.id)
      setTimeout(() => setConfirmDelete(c => c === ev.id ? null : c), 3000)
    }
  }

  async function handleAdd() {
    if (!addForm.title||!addForm.date||!addForm.startTime||!addForm.endTime) return
    // Only check for partner conflict when creating a shared "ours" event
    if (addForm.eventType === 'ours') {
      const clash = events.find(e =>
        ownerOf(e)==='partner' && e.date===addForm.date &&
        timeToMins(e.start_time)<timeToMins(addForm.endTime) &&
        timeToMins(e.end_time)>timeToMins(addForm.startTime)
      )
      if (clash) { setConflict({ form:addForm, clash }); return }
    }
    await commitAdd()
  }

  async function commitAdd() {
    setSaving(true)
    try {
      const dates = getRecurringDates(addForm.date, addForm.recurring, addForm.recurUntil)
      // Give all events in this recurring series the same series_id so we can delete them together
      const seriesId = dates.length > 1 ? crypto.randomUUID() : null
      for (const date of dates) {
        await createEvent({
          title:     addForm.eventType === 'ours' ? `💑 ${addForm.title}` : addForm.title,
          date,
          startTime: addForm.startTime,
          endTime:   addForm.endTime,
          isPrivate: addForm.isPrivate,
          eventType: addForm.eventType,
          location:  serializeLocation(addForm.location),
          notes:     addForm.notes,
          seriesId,
        })
      }
      const count = getRecurringDates(addForm.date, addForm.recurring, addForm.recurUntil).length
      setAddForm({title:'',date:'',startTime:'',endTime:'',isPrivate:false,recurring:'none',recurUntil:'',eventType:'mine',location:null,notes:''})
      setConflict(null)
      setShowAddModal(false)
      showToast(count > 1 ? `✿ ${count} events added!` : '✿ Event added successfully!', 'success')
    } catch(err) {
      console.error('[commitAdd]', err)
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Recurring date generator ──────────────────────────────
  function getRecurringDates(startDate, recurring, recurUntil) {
    if (!startDate) return []
    if (recurring === 'none' || !recurUntil) return [startDate]
    // Parse dates as LOCAL time (not UTC) by splitting the string manually
    // This avoids timezone shift bugs where "2026-03-13" becomes March 12 in UTC+8
    const parseLocal = (s) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }
    const dates = []
    const current = parseLocal(startDate)
    const until   = parseLocal(recurUntil)
    while (current <= until) {
      dates.push(toDateStr(current))
      if (recurring === 'daily')        current.setDate(current.getDate() + 1)
      else if (recurring === 'weekly')  current.setDate(current.getDate() + 7)
      else if (recurring === 'biweekly')current.setDate(current.getDate() + 14)
      else if (recurring === 'monthly') current.setMonth(current.getMonth() + 1)
      else break
    }
    return dates
  }

  async function handleUnlink() {
    if (!confirm(`Unlink from ${partner?.name}? You'll stop seeing each other's calendars.`)) return
    await unlinkPartner()
  }

  // Nav label
  let navLabel = ''
  if (calView==='day')  navLabel = `${DAYS[navDate.getDay()]}, ${MONTHS[navDate.getMonth()]} ${navDate.getDate()}`
  else if (calView==='week') navLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`
  else navLabel = `${MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}`

  // Free-together days
  const freeDays = (() => {
    let dates = calView==='day' ? [navDate]
      : calView==='week' ? weekDates
      : monthDates.filter(d=>d.inMonth).map(d=>d.date)
    return dates.map(d => {
      const ds = toDateStr(d)
      const slots = findFreeSlots(ds)
      return { date:d, dateStr:ds, slots }
    }).filter(d=>d.slots.length>0)
  })()

  const inp = { width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',colorScheme:'dark',fontFamily:'inherit' }

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Nunito',sans-serif",display:'flex',flexDirection:'column',position:'relative'}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
      <FloatingDoodles/>

      {/* ════ NAVBAR ════ */}
      <nav style={{position:'relative',zIndex:10,background:C.surface,borderBottom:`1px solid ${C.border}`}}>

        {/* ── Main row ── */}
        <div style={{
          padding:'0 12px', height:52,
          display:'flex', alignItems:'center', gap:8,
        }}>

          {/* Brand */}
          <div style={{fontFamily:"'Playfair Display'",fontSize:20,letterSpacing:'-0.5px',lineHeight:1,flexShrink:0}}>
            us<span style={{color:C.peach}}>.</span>cal
          </div>

          {/* Sync dot */}
          <div style={{flexShrink:0}}>
            {syncStatus==='synced'  && <span style={{fontSize:8,color:C.mint,fontWeight:700}}>●</span>}
            {syncStatus==='syncing' && <span style={{fontSize:8,color:C.peach,fontWeight:700}}>●</span>}
            {syncStatus==='offline' && <span style={{fontSize:8,color:C.textDim,fontWeight:700}}>●</span>}
          </div>

          {/* Date navigator - centred */}
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            <button onClick={()=>navCal(-1)} style={{background:'none',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>‹</button>
            <span style={{fontFamily:"'Playfair Display'",fontSize:isMobile?11:13,minWidth:isMobile?100:140,textAlign:'center',color:C.text,fontWeight:600}}>{navLabel}</span>
            <button onClick={()=>navCal(1)}  style={{background:'none',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>›</button>
          </div>

          {/* Desktop: theme toggle + settings dropdown */}
          {!isMobile && (
            <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,position:'relative'}}>
              {/* Theme toggle pill */}
              <button onClick={toggleTheme} style={{
                display:'flex',alignItems:'center',gap:6,
                background:C.surface,border:`1px solid ${C.border}`,
                borderRadius:20,padding:'5px 12px',cursor:'pointer',
                fontSize:12,fontWeight:700,color:C.textMid,fontFamily:'inherit',
                transition:'all 0.15s',
              }}>
                <span style={{fontSize:14}}>{mode==='light'?'🌙':'☀️'}</span>
                <span>{mode==='light'?'Dark':'Light'}</span>
              </button>
              {/* Account menu button */}
              <button
                onClick={()=>setMenuOpen(m=>!m)}
                style={{
                  display:'flex',alignItems:'center',gap:6,
                  background: menuOpen ? C.lavender+'22' : C.surface,
                  border:`1px solid ${menuOpen ? C.lavender+'66' : C.border}`,
                  borderRadius:20,padding:'5px 12px 5px 8px',cursor:'pointer',
                  fontSize:12,fontWeight:700,color:menuOpen?C.lavender:C.textMid,fontFamily:'inherit',
                  transition:'all 0.15s',
                }}>
                <div style={{
                  width:22,height:22,borderRadius:'50%',
                  background:C.mint+'33',border:`1.5px solid ${C.mint}66`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,
                }}>🌿</div>
                <span>{user?.name||'Account'}</span>
                <span style={{fontSize:9,opacity:0.6}}>{menuOpen?'▲':'▼'}</span>
              </button>
              {/* Desktop dropdown */}
              {menuOpen && (
                <div style={{
                  position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:500,
                  background:C.surface,border:`1px solid ${C.border}`,
                  borderRadius:16,padding:8,minWidth:200,
                  boxShadow:`0 8px 32px rgba(0,0,0,0.18)`,
                }}>
                  {/* User info */}
                  <div style={{padding:'10px 12px 8px',borderBottom:`1px solid ${C.border}`,marginBottom:6}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{user?.name||'You'}</div>
                    <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{user?.email||''}</div>
                  </div>
                  {/* Profile links */}
                  <button onClick={()=>{navigate('/profile?view=mine');setMenuOpen(false)}} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,
                    background:'none',border:'none',borderRadius:10,padding:'9px 12px',
                    cursor:'pointer',fontSize:13,color:C.text,fontFamily:'inherit',fontWeight:600,
                    transition:'background 0.1s',textAlign:'left',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:16}}>🌿</span> My Profile
                  </button>
                  {isLinked && <button onClick={()=>{navigate('/profile?view=partner');setMenuOpen(false)}} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,
                    background:'none',border:'none',borderRadius:10,padding:'9px 12px',
                    cursor:'pointer',fontSize:13,color:C.text,fontFamily:'inherit',fontWeight:600,
                    transition:'background 0.1s',textAlign:'left',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:16}}>🌷</span> {partner?.name||'Partner'}'s Profile
                  </button>}
                  <div style={{height:1,background:C.border,margin:'6px 0'}}/>
                  {/* Unlink */}
                  {isLinked && <button onClick={()=>{handleUnlink();setMenuOpen(false)}} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,
                    background:'none',border:'none',borderRadius:10,padding:'9px 12px',
                    cursor:'pointer',fontSize:13,color:C.rose,fontFamily:'inherit',fontWeight:600,
                    transition:'background 0.1s',textAlign:'left',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.rose+'12'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:16}}>💔</span> Disconnect partner
                  </button>}
                  {/* Sign out */}
                  <button onClick={signOut} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,
                    background:'none',border:'none',borderRadius:10,padding:'9px 12px',
                    cursor:'pointer',fontSize:13,color:C.textMid,fontFamily:'inherit',fontWeight:600,
                    transition:'background 0.1s',textAlign:'left',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >
                    <span style={{fontSize:16}}>🚪</span> Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile: account avatar button */}
          {isMobile && (
            <button onClick={()=>setMenuOpen(m=>!m)} style={{
              background: menuOpen ? C.lavender+'22' : C.surface,
              border:`1.5px solid ${menuOpen ? C.lavender+'88' : C.border}`,
              borderRadius:'50%',width:34,height:34,
              display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',fontSize:16,flexShrink:0,transition:'all 0.15s',
            }}>
              {menuOpen ? '✕' : '🌿'}
            </button>
          )}
        </div>

        {/* ── Mobile bottom sheet menu ── */}
        {isMobile && menuOpen && (
          <>
            {/* Backdrop */}
            <div onClick={()=>setMenuOpen(false)} style={{
              position:'fixed',inset:0,zIndex:498,background:'rgba(0,0,0,0.3)',
              backdropFilter:'blur(2px)',
            }}/>
            {/* Sheet */}
            <div style={{
              position:'fixed',bottom:0,left:0,right:0,zIndex:499,
              background:C.surface,borderRadius:'24px 24px 0 0',
              padding:'0 0 max(20px, env(safe-area-inset-bottom)) 0',
              boxShadow:'0 -8px 40px rgba(0,0,0,0.25)',
            }}>
              {/* Drag handle */}
              <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
                <div style={{width:40,height:4,borderRadius:2,background:C.border}}/>
              </div>
              {/* User info header */}
              <div style={{padding:'8px 20px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{
                  width:46,height:46,borderRadius:'50%',flexShrink:0,
                  background:C.mint+'22',border:`2px solid ${C.mint}55`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,
                }}>🌿</div>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:C.text}}>{user?.name||'You'}</div>
                  <div style={{fontSize:12,color:C.textDim,marginTop:1}}>{user?.email||''}</div>
                </div>
              </div>
              {/* Menu items */}
              <div style={{padding:'8px 12px'}}>
                {/* Profile links */}
                <button onClick={()=>{navigate('/profile?view=mine');setMenuOpen(false)}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  background:'none',border:'none',borderRadius:14,padding:'13px 10px',
                  cursor:'pointer',fontSize:15,color:C.text,fontFamily:'inherit',fontWeight:600,textAlign:'left',
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:12,
                    background:C.mint+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
                  }}>🌿</span>
                  <span>My Profile</span>
                </button>
                {isLinked && <button onClick={()=>{navigate('/profile?view=partner');setMenuOpen(false)}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  background:'none',border:'none',borderRadius:14,padding:'13px 10px',
                  cursor:'pointer',fontSize:15,color:C.text,fontFamily:'inherit',fontWeight:600,textAlign:'left',
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:12,
                    background:C.rose+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
                  }}>🌷</span>
                  <span>{partner?.name||'Partner'}'s Profile</span>
                </button>}
                {/* Dark mode toggle row */}
                <button onClick={()=>{toggleTheme();}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  background:'none',border:'none',borderRadius:14,padding:'13px 10px',
                  cursor:'pointer',fontSize:15,color:C.text,fontFamily:'inherit',fontWeight:600,textAlign:'left',
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:12,
                    background:C.lavender+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
                  }}>{mode==='light'?'🌙':'☀️'}</span>
                  <span style={{flex:1}}>{mode==='light'?'Dark mode':'Light mode'}</span>
                  {/* Toggle pill visual */}
                  <div style={{
                    width:44,height:26,borderRadius:13,flexShrink:0,
                    background: mode==='dark' ? C.lavender : C.border,
                    position:'relative',transition:'background 0.2s',
                  }}>
                    <div style={{
                      position:'absolute',top:3,
                      left: mode==='dark' ? 21 : 3,
                      width:20,height:20,borderRadius:'50%',
                      background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
                      transition:'left 0.2s',
                    }}/>
                  </div>
                </button>
                <div style={{height:1,background:C.border,margin:'4px 10px'}}/>
                {/* Disconnect partner */}
                {isLinked && <button onClick={()=>{handleUnlink();setMenuOpen(false)}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  background:'none',border:'none',borderRadius:14,padding:'13px 10px',
                  cursor:'pointer',fontSize:15,color:C.rose,fontFamily:'inherit',fontWeight:600,textAlign:'left',
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:12,
                    background:C.rose+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
                  }}>💔</span>
                  <span>Disconnect partner</span>
                </button>}
                {/* Sign out */}
                <button onClick={signOut} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  background:'none',border:'none',borderRadius:14,padding:'13px 10px',
                  cursor:'pointer',fontSize:15,color:C.textMid,fontFamily:'inherit',fontWeight:600,textAlign:'left',
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:12,
                    background:C.bg,border:`1px solid ${C.border}`,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
                  }}>🚪</span>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Not linked banner ── */}
        {!isLinked && (
          <div style={{background:C.mint+'14',borderTop:`1px solid ${C.mint}28`,padding:'7px 16px',fontSize:12,color:C.mint,display:'flex',alignItems:'center',gap:10}}>
            <span style={{flex:1}}>🌻 Connect with your partner to see shared availability.</span>
            <button onClick={()=>navigate('/connect')} style={{background:C.mint,color:'#fff',border:'none',borderRadius:20,padding:'4px 14px',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>Connect ✨</button>
          </div>
        )}

        {/* ── Row 2: View toggle + tabs ── */}
        <div style={{
          borderTop:`1px solid ${C.border}`,
          padding:`0 ${isMobile?8:16}px`, height:44,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:4,
        }}>
          {/* View toggle */}
          <div style={{display:'flex',background:C.bg,border:`1px solid ${C.border}`,borderRadius:20,padding:2,gap:1,flexShrink:0}}>
            {(isMobile ? ['day','week','month'] : ['day','week','month']).map(v=>(
              <button key={v} onClick={()=>setCalView(v)} style={{
                background:calView===v?C.peach:'transparent',
                color:calView===v?'#fff':C.textDim,
                border:'none',borderRadius:18,
                padding: isMobile ? '4px 10px' : '3px 14px',
                fontSize:isMobile?10:11,fontWeight:calView===v?700:500,
                cursor:'pointer',textTransform:'capitalize',transition:'all 0.2s',
              }}>{v}</button>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:1,alignItems:'center',gap:4}}>
            {[['calendar', isMobile?'🗓':'🗓 Calendar'],['compare', isMobile?'↔':'↔ Compare']].map(([v,label])=>{
              const active = tab===v
              const color  = v==='compare'?C.lavender:C.mint
              return (
                <button key={v} onClick={()=>setTab(v)} style={{
                  background: active ? color : 'transparent',
                  color: active ? '#fff' : C.textMid,
                  border:'none', borderRadius:20,
                  padding: isMobile ? '5px 10px' : '5px 14px',
                  fontSize:isMobile?13:11, fontWeight:active?700:500,
                  cursor:'pointer', transition:'all 0.2s',
                }}>
                  {label}
                </button>
              )
            })}
          </div>
          {calView==='month' && tab==='calendar' && (
            <button onClick={()=>stickerMode ? exitStickerMode() : enterStickerMode()} style={{
              background: stickerMode ? C.lavender : 'none',
              border:`1.5px solid ${stickerMode ? C.lavender : C.border}`,
              color: stickerMode ? '#fff' : C.textMid,
              borderRadius:20, padding: isMobile ? '5px 10px' : '5px 14px',
              fontSize:isMobile?14:12, cursor:'pointer', flexShrink:0,
              transition:'all 0.15s', fontWeight:700,
              boxShadow: stickerMode ? `0 0 0 3px ${C.lavender}44` : 'none',
            }}>🎀{!isMobile && (stickerMode ? ' Done' : ' Stickers')}</button>
          )}

          <button onClick={()=>{setAddForm({title:'',date:toDateStr(new Date()),startTime:'',endTime:'',isPrivate:false,recurring:'none',recurUntil:'',eventType:'mine',location:null,notes:''});setShowAddModal(true)}} style={{
            background:C.peach, color:'#fff', border:'none', borderRadius:20,
            padding: isMobile ? '5px 12px' : '5px 16px',
            fontSize:isMobile?16:13, fontWeight:700, cursor:'pointer',
            display:'flex',alignItems:'center',gap:4, flexShrink:0,
            boxShadow:`0 2px 8px ${C.peach}55`,
          }}>
            <span style={{fontSize:isMobile?16:14}}>＋</span>
            {!isMobile && 'Add'}
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{flex:1,position:'relative',overflow:'clip'}}>
      {/* Sticker tray popover — fixed so it doesn't get clipped */}
      {stickerMode && stickerTargetDate && (
        <div style={{position:'fixed',top:104,right:12,zIndex:200}}>
          <StickerTray
            onAdd={def => addDateSticker(def, stickerTargetDate)}
            onClose={()=>setStickerTargetDate(null)}
            C={C} isMobile={isMobile}
            date={stickerTargetDate}
          />
        </div>
      )}
      {/* Sticker mode banner */}
      {stickerMode && (
        <div style={{
          position:'fixed', top:96, left:0, right:0, zIndex:190,
          background: C.lavender, color:'#fff',
          padding:'7px 16px', fontSize:12, fontWeight:700,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          boxShadow:`0 2px 12px ${C.lavender}66`,
        }}>
          <span>🎀 Sticker mode — tap a date to place a sticker</span>
          <button onClick={exitStickerMode} style={{
            background:'rgba(255,255,255,0.25)', border:'none',
            borderRadius:12, padding:'3px 12px', color:'#fff',
            fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit',
          }}>✕ Done</button>
        </div>
      )}
      <main onClick={()=>setConfirmDelete(null)} style={{height:'100%',padding: isMobile ? '10px 10px' : '14px 24px',overflowY: tab==='compare'?'hidden':'auto',display:'flex',flexDirection:'column',position:'relative',zIndex:1,scrollBehavior:'smooth',WebkitOverflowScrolling:'touch'}}>

        {/* ════ CALENDAR TAB ════ */}
        {tab==='calendar' && (
          <>
            {/* MONTH VIEW */}
            {calView==='month' && (
              <div>
                {/* Day headers */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:isMobile?2:4,marginBottom:isMobile?4:8}}>
                  {(isMobile?['S','M','T','W','T','F','S']:DAYS).map((d,i)=>(
                    <div key={i} style={{textAlign:'center',fontSize:isMobile?10:11,color:C.textDim,padding:'4px 0',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700}}>{d}</div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:isMobile?3:5}}>
                  {monthDates.map(({date,inMonth},i)=>{
                    const ds=toDateStr(date), isToday=ds===todayStr
                    const dayEvs=eventsForDate(ds)
                    const freeSlots=findFreeSlots(ds)
                    const hasOurs = dayEvs.some(e=>e.event_type==='ours'||e.title?.startsWith('💑'))
                    const cellStickers = calStickers.filter(s => s.date === ds)
                    const isStickerTarget = stickerMode && stickerTargetDate === ds
                    return (
                      <div key={i}
                        onClick={e=>{
                          if (!inMonth) return
                          if (stickerMode) {
                            e.stopPropagation()
                            setStickerTargetDate(ds)
                            return
                          }
                          goToDay(date)
                        }}
                        style={{
                          background: isToday ? C.peach+'11' : isStickerTarget ? C.lavender+'18' : C.surface,
                          border:`1.5px solid ${isStickerTarget ? C.lavender : isToday ? C.peach+'88' : hasOurs ? C.lavender+'55' : C.border}`,
                          borderRadius:isMobile?10:14, padding:isMobile?'8px 5px':'10px 8px',
                          minHeight:isMobile?68:90,
                          opacity:inMonth?1:0.25, cursor:inMonth?(stickerMode?'cell':'pointer'):'default',
                          transition:'all 0.15s', position:'relative', overflow:'visible',
                        }}>
                        {isToday && <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.peach}00,${C.peach},${C.peach}00)`,borderRadius:'14px 14px 0 0'}}/>}
                        <div style={{
                          fontSize:isMobile?15:18, fontFamily:"'Playfair Display'", fontWeight:600,
                          color:isToday?C.peach:C.text, marginBottom:isMobile?3:5,
                          lineHeight:1,
                        }}>{date.getDate()}</div>
                        {dayEvs.slice(0, isMobile?1:3).map(ev=>(
                          <div key={ev.id} onClick={e=>{e.stopPropagation();if(!stickerMode)setSelectedEvent(ev)}} style={{
                            background:eventColor(ev)+'20',
                            borderLeft:`3px solid ${eventColor(ev)}`,
                            borderRadius:'0 5px 5px 0', padding:isMobile?'1px 4px':'2px 6px', marginBottom:2,
                            fontSize:isMobile?9:10, color:eventColor(ev), fontWeight:600,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          }}>
                            {eventLabel(ev)?.replace(/^💑\s?/,'')}
                          </div>
                        ))}
                        {dayEvs.length>(isMobile?1:3) && <div style={{fontSize:9,color:C.textDim,fontWeight:600}}>+{dayEvs.length-(isMobile?1:3)}</div>}
                        {inMonth&&freeSlots.length>0 && <div style={{position:'absolute',bottom:isMobile?4:6,right:isMobile?5:7,fontSize:9,color:C.gold,fontWeight:700,pointerEvents:'none'}}>✦</div>}

                        {/* ── Stickers on this cell ── */}
                        {cellStickers.length > 0 && (
                          <CanvasStickerLayer
                            stickers={cellStickers}
                            onChange={changed => {
                              // Merge changed stickers back into the full list
                              updateDateStickers([
                                ...calStickers.filter(s => s.date !== ds),
                                ...changed,
                              ])
                            }}
                            onDelete={removeDateSticker}
                            C={C}
                          />
                        )}

                        {/* ── "Add sticker here" hint when tray is open ── */}
                        {/* Sticker mode overlay hints */}
                        {inMonth && stickerMode && (
                          <div style={{
                            position:'absolute', inset:0, borderRadius:'inherit',
                            background: isStickerTarget ? C.lavender+'28' : C.lavender+'0a',
                            border: isStickerTarget ? `2px solid ${C.lavender}88` : 'none',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            pointerEvents:'none', transition:'all 0.15s',
                          }}>
                            {isStickerTarget
                              ? <span style={{fontSize:20}}>🎀</span>
                              : <span style={{fontSize:10,color:C.lavender,fontWeight:700,opacity:0.6}}>＋</span>
                            }
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView==='week' && (
              <div style={{overflowX: isMobile ? 'auto' : 'visible', marginLeft: isMobile ? -10 : 0, marginRight: isMobile ? -10 : 0, paddingLeft: isMobile ? 10 : 0, paddingRight: isMobile ? 10 : 0}}>
              <div style={{display:'grid', gridTemplateColumns:`repeat(7,${isMobile ? 'minmax(110px,1fr)' : '1fr'})`, gap:6, minWidth: isMobile ? 770 : 'unset'}}>
                {weekDates.map((date,i)=>{
                  const ds=toDateStr(date), isToday=ds===todayStr
                  const dayEvs=eventsForDate(ds)
                  const freeSlots=findFreeSlots(ds)
                  const hasOurs = dayEvs.some(e=>e.event_type==='ours'||e.title?.startsWith('💑'))
                  return (
                    <div key={i}
                      onClick={()=>goToDay(date)}
                      style={{
                        background:isToday?C.peach+'11':C.surface,
                        border:`1.5px solid ${isToday?C.peach+'88':hasOurs?C.lavender+'55':C.border}`,
                        borderRadius:14, padding:'14px 12px', minHeight: isMobile ? 160 : 220,
                        position:'relative', overflow:'hidden', cursor:'pointer',
                        transition:'border-color 0.15s',
                      }}>
                      {isToday && <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.peach}00,${C.peach},${C.peach}00)`}}/>}
                      <div style={{fontSize:isMobile?10:11,color:isToday?C.peach:C.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>{DAYS[date.getDay()]}</div>
                      <div style={{fontSize:isMobile?26:32,fontFamily:"'Playfair Display'",color:isToday?C.peach:C.text,marginBottom:isMobile?8:12,fontWeight:600,lineHeight:1}}>{date.getDate()}</div>
                      {dayEvs.map(ev=>(
                        <div key={ev.id} onClick={e=>{e.stopPropagation();setSelectedEvent(ev)}} style={{
                          background:eventColor(ev)+'20',
                          borderLeft:`3px solid ${eventColor(ev)}`,
                          borderRadius:'0 7px 7px 0', padding: isMobile ? '3px 7px' : '5px 9px', marginBottom:4,
                          fontSize:isMobile?10:11, color:eventColor(ev), fontWeight:600,
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          cursor:'pointer', transition:'all 0.15s',
                        }}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,fontSize:10}}>
                            {eventLabel(ev)?.replace(/^💑\s?/,'')}
                          </span>
                          {canDelete(ev)&&(
                            <button onClick={e=>quickDelete(e,ev)} style={{
                              background: confirmDelete===ev.id ? C.rose : 'transparent',
                              border:'none', borderRadius:4, cursor:'pointer', flexShrink:0,
                              fontSize:10, padding:'1px 4px', marginLeft:2,
                              color: confirmDelete===ev.id ? '#fff' : C.rose,
                              fontWeight:700, transition:'all 0.15s', fontFamily:'inherit',
                            }}>
                              {confirmDelete===ev.id ? '✓?' : '🗑'}
                            </button>
                          )}
                        </div>
                      ))}
                      {freeSlots.length>0 && <div style={{marginTop:5,fontSize:9,color:C.gold,fontWeight:700}}>✦ {freeSlots.length} free slot{freeSlots.length>1?'s':''}</div>}
                    </div>
                  )
                })}
              </div>
              </div>
            )}

            {/* DAY VIEW */}
            {calView==='day' && (
              <div>
                <div style={{marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{fontFamily:"'Playfair Display'",fontSize:24,fontWeight:600,color:navDateStr===todayStr?C.peach:C.text}}>
                    {DAYS[navDate.getDay()]}, {MONTHS[navDate.getMonth()]} {navDate.getDate()}
                  </div>
                  {navDateStr===todayStr&&<span style={{fontSize:10,color:C.peach,background:C.peach+'22',border:`1px solid ${C.peach}44`,padding:'2px 10px',borderRadius:12,fontWeight:700}}>✿ Today</span>}
                </div>
                {/* ── Day view: two-column time grid ── */}
                {(()=>{
                  const ROW_H = isMobile ? 56 : 72
                  const TIME_W = isMobile ? 44 : 60
                  const GAP    = 4
                  const firstHour = HOUR_ROWS[0]
                  const dayEvs  = eventsForDate(navDateStr)
                  const freeSlots = findFreeSlots(navDateStr)

                  // Split into columns: yours (left), partner (right), ours (full-width)
                  const yourEvs    = dayEvs.filter(e => ownerOf(e)==='you' && e.event_type!=='ours' && !e.title?.startsWith('💑'))
                  const partnerEvs = dayEvs.filter(e => ownerOf(e)==='partner' && e.event_type!=='ours' && !e.title?.startsWith('💑'))
                  const sharedEvs  = dayEvs.filter(e => e.event_type==='ours' || e.title?.startsWith('💑'))

                  function evTop(ev)  { return ((timeToMins(ev.start_time) - firstHour*60) / 60) * ROW_H }
                  function evH(ev)    { return Math.max(((timeToMins(ev.end_time||ev.start_time) - timeToMins(ev.start_time)) / 60) * ROW_H, 32) }

                  function EventBlock({ ev, left, width, isShared }) {
                    const color  = eventColor(ev)
                    const top    = evTop(ev)
                    const h      = evH(ev)
                    const loc    = parseLocation(ev.location)
                    const mapsUrl = loc?.lat ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : loc?.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name)}` : null
                    if (timeToMins(ev.start_time) < firstHour*60) return null
                    return (
                      <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{
                        position:'absolute', top, left, width,
                        height: h, boxSizing:'border-box',
                        background: isShared
                          ? `linear-gradient(135deg, ${C.mint}28, ${C.lavender}28)`
                          : color+'1e',
                        border: `1.5px solid ${color}55`,
                        borderLeft: `4px solid ${color}`,
                        borderRadius: 10,
                        padding: h > 44 ? '7px 10px 6px' : '4px 8px',
                        cursor:'pointer', overflow:'hidden',
                        display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:1,
                        pointerEvents:'auto',
                        transition:'box-shadow 0.15s',
                        boxShadow:`0 1px 4px ${color}22`,
                      }}>
                        {/* Title row */}
                        <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>

                          <span style={{
                            fontWeight:700, fontSize: h>44 ? 12 : 11,
                            color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
                          }}>{eventLabel(ev)?.replace(/^💑\s?/,'')}</span>
                        </div>
                        {/* Time — show if tall enough */}
                        {h > 44 && (
                          <div style={{fontSize:10,color,opacity:0.7,fontWeight:500,letterSpacing:'0.02em'}}>
                            {ev.start_time} – {ev.end_time}
                          </div>
                        )}
                        {/* Location — show if tall enough */}
                        {h > 72 && loc?.name && mapsUrl && (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e=>e.stopPropagation()}
                            style={{fontSize:10,color:C.textDim,display:'flex',alignItems:'center',gap:3,textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}
                            onMouseEnter={e=>e.currentTarget.style.color=C.peach}
                            onMouseLeave={e=>e.currentTarget.style.color=C.textDim}
                          >📍 {loc.name}</a>
                        )}
                        {/* Delete — pinned to bottom if tall enough */}
                        {canDelete(ev) && h > 80 && (
                          <button onClick={e=>quickDelete(e,ev)} style={{
                            background: confirmDelete===ev.id ? C.rose : 'transparent',
                            border:`1px solid ${C.rose}44`, borderRadius:6,
                            cursor:'pointer', fontSize:10, padding:'2px 8px',
                            color: confirmDelete===ev.id ? '#fff' : C.rose,
                            fontWeight:700, marginTop:'auto', alignSelf:'flex-start',
                            transition:'all 0.15s', fontFamily:'inherit', pointerEvents:'auto',
                          }}>
                            {confirmDelete===ev.id ? '✓ sure?' : '🗑 remove'}
                          </button>
                        )}
                      </div>
                    )
                  }

                  const totalH = HOUR_ROWS.length * ROW_H

                  return (
                    <div style={{borderRadius:14,overflow:'hidden',border:`1px solid ${C.border}`,background:C.surface}}>
                      {/* Column headers */}
                      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.bg}}>
                        <div style={{width:TIME_W,flexShrink:0}}/>
                        <div style={{flex:1,padding:'7px 0 7px 10px',fontSize:11,fontWeight:700,color:C.mint,borderLeft:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:5}}>
                          <span>🌿</span>{user?.name||'You'}
                        </div>
                        <div style={{flex:1,padding:'7px 0 7px 10px',fontSize:11,fontWeight:700,color:C.rose,borderLeft:`1px solid ${C.border}33`,display:'flex',alignItems:'center',gap:5}}>
                          <span>🌷</span>{partner?.name||'Partner'}
                        </div>
                      </div>

                      {/* Grid */}
                      <div style={{position:'relative'}}>
                        {/* Hour rows */}
                        {HOUR_ROWS.map(hour=>{
                          const isFree = freeSlots.some(([s,e])=>s<=hour*60&&e>=(hour+1)*60)
                          return (
                            <div key={hour} style={{display:'flex',height:ROW_H,borderBottom:`1px solid ${C.border}`,background:isFree?C.gold+'0a':'transparent',boxSizing:'border-box',position:'relative'}}>
                              <div style={{width:TIME_W,flexShrink:0,paddingRight:8,paddingTop:6,fontSize:isMobile?9:11,color:C.textDim,textAlign:'right',fontWeight:600,lineHeight:1,borderRight:`1px solid ${C.border}`}}>
                                {String(hour%12||12)}{hour<12?'am':'pm'}
                              </div>
                              {/* Left col */}
                              <div style={{flex:1,borderRight:`1px dashed ${C.border}55`}}/>
                              {/* Right col */}
                              <div style={{flex:1}}/>
                              {/* Free band label */}
                              {isFree && <div style={{position:'absolute',top:5,right:10,fontSize:9,color:C.gold,fontWeight:700,opacity:0.7,pointerEvents:'none'}}>✦ both free</div>}
                            </div>
                          )
                        })}

                        {/* Event overlay */}
                        <div style={{position:'absolute',inset:0,left:TIME_W,pointerEvents:'none'}}>
                          {/* Shared events — full width */}
                          {sharedEvs.map(ev=>(
                            <EventBlock key={ev.id} ev={ev}
                              left={GAP} width={`calc(100% - ${GAP*2}px)`} isShared={true}/>
                          ))}
                          {/* Your events — left half */}
                          {yourEvs.map(ev=>(
                            <EventBlock key={ev.id} ev={ev}
                              left={GAP} width={`calc(50% - ${GAP*1.5}px)`} isShared={false}/>
                          ))}
                          {/* Partner events — right half */}
                          {partnerEvs.map(ev=>(
                            <EventBlock key={ev.id} ev={ev}
                              left={`calc(50% + ${GAP*0.5}px)`} width={`calc(50% - ${GAP*1.5}px)`} isShared={false}/>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const slots=findFreeSlots(navDateStr)
                  return slots.length>0?(
                    <div style={{marginTop:12,background:C.gold+'14',border:`1px solid ${C.gold}44`,borderRadius:12,padding:'12px 16px'}}>
                      <div style={{fontSize:11,color:C.gold,marginBottom:6,fontWeight:700}}>✦ You're both free — plan something! 🌟</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {slots.map(([s,e],i)=>(
                          <span key={i} style={{background:C.gold+'22',color:C.gold,border:`1px solid ${C.gold}44`,borderRadius:20,padding:'3px 11px',fontSize:11,fontWeight:600}}>{minsToTime(s)} – {minsToTime(e)}</span>
                        ))}
                      </div>
                    </div>
                  ):null
                })()}
              </div>
            )}
          </>
        )}

        {/* ════ COMPARE TAB ════ */}
        {tab==='compare' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,position:'relative'}}>
            <CompareView
              events={events}
              onSelectEvent={setSelectedEvent}
              onAddEvent={(prefill)=>{
                setAddForm(f=>({...f,...prefill,
                  startTime: prefill.startTime||'',
                  endTime:   prefill.endTime||'',
                  date:      prefill.date||'',
                  eventType: prefill.eventType||'mine',
                }))
                setShowAddModal(true)
              }}
            />
          </div>
        )}



        {/* ════ ADD EVENT MODAL ════ */}
        {showAddModal && (
          <div onClick={()=>setShowAddModal(false)} style={{
            position:'fixed',
            top: isMobile ? 0 : 96,
            left: 0, right: 0, bottom: 0,
            zIndex:200,
            background:'rgba(0,0,0,0.5)',
            backdropFilter:'blur(8px)',
            display:'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent:'center',
            padding: isMobile ? '0' : '20px 24px',
          }}>
            <div onClick={e=>e.stopPropagation()} style={{
              width:'100%', maxWidth:500,
              background:C.surface,
              borderRadius: isMobile ? '24px 24px 0 0' : 20,
              maxHeight: isMobile ? 'calc(100svh - 60px)' : 'calc(100vh - 96px - 40px)',
              display:'flex', flexDirection:'column',
              boxShadow: isMobile ? '0 -12px 60px rgba(0,0,0,0.4)' : '0 24px 80px rgba(0,0,0,0.35)',
              overflow:'hidden',
            }}>
              {/* ── Sticky header ── */}
              <div style={{padding: isMobile ? '16px 22px 14px' : '24px 28px 16px', flexShrink:0, borderBottom:`1px solid ${C.border}`}}>
                {isMobile && <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:'0 auto 16px'}}/>}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontFamily:"'Playfair Display'",fontSize:21,color:C.text,fontWeight:600}}>
                    {addForm.eventType==='ours' ? '💕 New shared event' : '🌿 New event'}
                  </div>
                  <button onClick={()=>setShowAddModal(false)} style={{
                    background:C.bg, border:`1px solid ${C.border}`,
                    color:C.textDim, cursor:'pointer',
                    width:32, height:32, borderRadius:8, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  }}>✕</button>
                </div>
              </div>
              {/* ── Scrollable form body ── */}
              <div style={{overflowY:'auto',flex:1,padding: isMobile ? '20px 22px' : '22px 28px',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:18}}>
                {[['mine','🌿','Just me',C.mint],['ours','💕','For us',C.lavender]].map(([type,emoji,label,color])=>(
                  <button key={type} onClick={()=>setAddForm(f=>({...f,eventType:type,isPrivate:false}))} style={{
                    background: addForm.eventType===type ? color+'22' : C.bg,
                    border:`1.5px solid ${addForm.eventType===type ? color : C.border}`,
                    color: addForm.eventType===type ? color : C.textDim,
                    borderRadius:12, padding:'10px 8px', cursor:'pointer', textAlign:'center', transition:'all 0.2s',
                  }}>
                    <div style={{fontSize:18,marginBottom:3}}>{emoji}</div>
                    <div style={{fontSize:12,fontWeight:700}}>{label}</div>
                  </button>
                ))}
              </div>
              <div style={{marginBottom:13}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Title</label>
                <input autoFocus type="text" placeholder={addForm.eventType==='ours'?'e.g. Dinner date 🍽️':'e.g. Gym session 🏃'} value={addForm.title} onChange={e=>setAddForm(f=>({...f,title:e.target.value}))} style={inp}/>
              </div>
              <div style={{marginBottom:13}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Date</label>
                <input type="date" value={addForm.date} onChange={e=>setAddForm(f=>({...f,date:e.target.value}))} style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:13}}>
                <div>
                  <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>Start</label>
                  <input type="time" value={addForm.startTime} onChange={e=>setAddForm(f=>({...f,startTime:e.target.value}))} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>End</label>
                  <input type="time" value={addForm.endTime} onChange={e=>setAddForm(f=>({...f,endTime:e.target.value}))} style={inp}/>
                </div>
              </div>
              <div style={{marginBottom:13}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>📍 Location <span style={{textTransform:'none',letterSpacing:0,fontWeight:400,opacity:0.6}}>(optional)</span></label>
                <LocationPicker value={addForm.location} onChange={loc=>setAddForm(f=>({...f,location:loc}))} apiKey={import.meta.env.VITE_GOOGLE_MAPS_KEY}/>
              </div>
              <div style={{marginBottom:13}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>📝 Notes <span style={{textTransform:'none',letterSpacing:0,fontWeight:400,opacity:0.6}}>(optional)</span></label>
                <textarea placeholder="Any details or reminders…" value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{marginBottom:13}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6,fontWeight:700}}>Repeat</label>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[['none','Once'],['daily','Daily'],['weekly','Weekly'],['biweekly','2 weeks'],['monthly','Monthly']].map(([val,label])=>(
                    <button key={val} onClick={()=>setAddForm(f=>({...f,recurring:val}))} style={{
                      background: addForm.recurring===val ? C.mint+'22' : C.bg,
                      border:`1px solid ${addForm.recurring===val ? C.mint : C.border}`,
                      color: addForm.recurring===val ? C.mint : C.textDim,
                      borderRadius:20, padding:'5px 12px', fontSize:11, cursor:'pointer',
                      fontWeight:addForm.recurring===val?700:400,
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              {addForm.recurring !== 'none' && (
                <div style={{marginBottom:13,background:C.bg,borderRadius:10,padding:'10px 14px',border:`1px solid ${C.border}`}}>
                  <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6,fontWeight:700}}>Repeat until</label>
                  <input type="date" value={addForm.recurUntil} onChange={e=>setAddForm(f=>({...f,recurUntil:e.target.value}))} style={{...inp,background:'transparent',border:'none',padding:'0'}}/>
                  {addForm.date && addForm.recurUntil && (
                    <div style={{fontSize:10,color:C.mint,marginTop:6,fontWeight:600}}>✿ {getRecurringDates(addForm.date,addForm.recurring,addForm.recurUntil).length} events will be created</div>
                  )}
                </div>
              )}
              {addForm.eventType==='mine' && (
                <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer',fontSize:12,color:C.textMid}}>
                  <input type="checkbox" checked={addForm.isPrivate} onChange={e=>setAddForm(f=>({...f,isPrivate:e.target.checked}))} style={{accentColor:C.mint,width:16,height:16}}/>
                  🔒 Keep private (partner sees "Busy")
                </label>
              )}
              {conflict && (
                <div style={{background:C.rose+'18',border:`1px solid ${C.rose}44`,borderRadius:12,padding:'12px 14px',marginBottom:14}}>
                  <div style={{color:C.rose,fontSize:13,fontWeight:700,marginBottom:4}}>⚠️ Partner has a conflict</div>
                  <div style={{fontSize:12,color:C.textMid}}>"{conflict.clash.title}" at {conflict.clash.start_time}–{conflict.clash.end_time}</div>
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <button onClick={()=>setConflict(null)} style={{flex:1,background:'none',border:`1px solid ${C.border}`,borderRadius:10,padding:'7px',fontSize:12,cursor:'pointer',color:C.textMid,fontFamily:'inherit'}}>Cancel</button>
                    <button onClick={commitAdd} style={{flex:2,background:C.rose,color:'#fff',border:'none',borderRadius:10,padding:'7px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Add anyway</button>
                  </div>
                </div>
              )}
              </div>{/* end scroll body */}

              {/* ── Sticky footer ── */}
              <div style={{
                padding: isMobile ? '14px 22px max(20px,env(safe-area-inset-bottom))' : '16px 28px 24px',
                borderTop:`1px solid ${C.border}`, flexShrink:0, background:C.surface,
              }}>
                <button onClick={handleAdd} disabled={saving} style={{
                  width:'100%',
                  background: addForm.eventType==='ours' ? C.lavender : C.mint,
                  color:'#fff', border:'none', borderRadius:14, padding:'15px',
                  fontSize:15, fontWeight:700, cursor:'pointer',
                  opacity:saving?0.6:1, transition:'all 0.2s',
                  boxShadow:`0 4px 20px ${addForm.eventType==='ours'?C.lavender:C.mint}55`,
                }}>
                  {saving ? '✿ Saving…' : addForm.recurring!=='none'&&addForm.recurUntil
                    ? `✿ Create ${getRecurringDates(addForm.date,addForm.recurring,addForm.recurUntil).length} events`
                    : addForm.eventType==='ours' ? '💕 Add shared event' : '✿ Add event'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Event detail modal ── */}
        {selectedEvent && (() => {
          const ev = selectedEvent
          const color = eventColor(ev)
          const loc = parseLocation(ev.location)
          const isEditing = !!editForm
          return (
            <div onClick={closeModal} style={{
              position:'fixed',
              top: isMobile ? 0 : 96, left:0, right:0, bottom:0,
              zIndex:300,
              background:'rgba(0,0,0,0.5)',
              backdropFilter:'blur(8px)',
              display:'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent:'center',
              padding: isMobile ? '0' : '20px 24px',
            }}>
              <div onClick={e=>e.stopPropagation()} style={{
                width:'100%', maxWidth:480,
                background:C.surface,
                borderRadius: isMobile ? '24px 24px 0 0' : 20,
                maxHeight: isMobile ? 'calc(100vh - 96px)' : 'calc(100vh - 96px - 40px)',
                display:'flex', flexDirection:'column',
                boxShadow: isMobile ? '0 -8px 48px rgba(0,0,0,0.3)' : '0 24px 80px rgba(0,0,0,0.3)',
                overflow:'hidden',
              }}>
                {/* Fixed header area */}
                <div style={{padding: isMobile ? '14px 20px 0' : '22px 24px 0', flexShrink:0}}>
                  {isMobile && <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:'0 auto 14px'}}/>}
                {/* Header */}
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    {isEditing
                      ? <input value={editForm.title} onChange={e=>setEditForm(f=>({...f,title:e.target.value}))} style={{...inp,fontFamily:"'Playfair Display'",fontSize:18,fontWeight:600,padding:'6px 10px'}}/>
                      : <div style={{fontFamily:"'Playfair Display'",fontSize:18,fontWeight:600,color:C.text,lineHeight:1.3}}>{ev.title?.replace(/^💑\s?/,'')}</div>
                    }
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:color}}/>
                      <span style={{fontSize:11,color:color,fontWeight:700}}>{ev.event_type==='ours'?'💕 Shared':ownerOf(ev)==='you'?'🌿 Yours':'🌷 Partner\'s'}</span>
                      {ev.is_private&&<span style={{fontSize:10,color:C.textDim,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'1px 7px'}}>🔒 Private</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexShrink:0,marginLeft:10}}>
                    {canEdit(ev) && !isEditing && <button onClick={()=>openEdit(ev)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 10px',fontSize:11,cursor:'pointer',color:C.textMid,fontFamily:'inherit',fontWeight:600}}>Edit</button>}
                    {isEditing && <button onClick={()=>setEditForm(null)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 10px',fontSize:11,cursor:'pointer',color:C.textMid,fontFamily:'inherit'}}>Cancel</button>}
                    {isEditing && <button onClick={handleSaveEdit} disabled={saving} style={{background:C.mint,border:'none',borderRadius:8,padding:'5px 12px',fontSize:11,cursor:'pointer',color:'#fff',fontFamily:'inherit',fontWeight:700}}>{saving?'…':'Save'}</button>}
                    <button onClick={closeModal} style={{background:'none',border:'none',color:C.textDim,fontSize:20,cursor:'pointer',padding:'2px 5px',lineHeight:1}}>✕</button>
                  </div>
                </div>
                </div>{/* end fixed header */}
                {/* Scrollable body */}
                <div style={{overflowY:'auto',flex:1,padding: isMobile ? '0 20px' : '0 24px',paddingBottom:'max(24px, env(safe-area-inset-bottom))',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
                {/* Detail rows */}
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:14}}>
                  {/* Date */}
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.bg,borderRadius:10}}>
                    <span style={{fontSize:16}}>📅</span>
                    {isEditing
                      ? <input type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} style={{...inp,padding:'4px 8px',flex:1}}/>
                      : <span style={{fontSize:13,color:C.text,fontWeight:600}}>{ev.date}</span>
                    }
                  </div>
                  {/* Time */}
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.bg,borderRadius:10}}>
                    <span style={{fontSize:16}}>🕐</span>
                    {isEditing
                      ? <div style={{display:'flex',gap:8,flex:1,alignItems:'center'}}>
                          <input type="time" value={editForm.startTime} onChange={e=>setEditForm(f=>({...f,startTime:e.target.value}))} style={{...inp,padding:'4px 8px',flex:1}}/>
                          <span style={{color:C.textDim}}>–</span>
                          <input type="time" value={editForm.endTime} onChange={e=>setEditForm(f=>({...f,endTime:e.target.value}))} style={{...inp,padding:'4px 8px',flex:1}}/>
                        </div>
                      : <span style={{fontSize:13,color:C.text,fontWeight:600}}>{ev.start_time} – {ev.end_time}</span>
                    }
                  </div>
                  {/* Location */}
                  {isEditing
                    ? <div style={{padding:'8px 12px',background:C.bg,borderRadius:10}}>
                        <LocationPicker value={editForm.location} onChange={loc=>setEditForm(f=>({...f,location:loc}))} apiKey={import.meta.env.VITE_GOOGLE_MAPS_KEY}/>
                      </div>
                    : loc?.name && <LocationPicker value={loc} readOnly apiKey={import.meta.env.VITE_GOOGLE_MAPS_KEY}/>
                  }
                  {/* Notes */}
                  {isEditing
                    ? <textarea value={editForm.notes||''} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Notes…" style={{...inp,resize:'vertical'}}/>
                    : ev.notes && <div style={{padding:'8px 12px',background:C.bg,borderRadius:10,fontSize:13,color:C.textMid,lineHeight:1.5}}>📝 {ev.notes}</div>
                  }
                  {isEditing && ev.event_type!=='ours' && (
                    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:C.textMid,padding:'4px 0'}}>
                      <input type="checkbox" checked={editForm.isPrivate} onChange={e=>setEditForm(f=>({...f,isPrivate:e.target.checked}))} style={{accentColor:C.mint}}/>
                      🔒 Keep private
                    </label>
                  )}
                </div>

                {/* Actions */}
                {!isEditing && canDelete(ev) && (
                  <button onClick={()=>handleDelete(ev)} style={{
                    marginTop:16, marginBottom:8, width:'100%', background:'none',
                    border:`1px solid ${C.rose}55`, borderRadius:12, padding:'10px',
                    fontSize:13, color:C.rose, cursor:'pointer', fontFamily:'inherit', fontWeight:600,
                  }}>🗑 Delete event</button>
                )}
                </div>{/* end detail rows */}
                </div>{/* end scroll body */}
              </div>
          )
        })()}

      {/* ── Series delete modal ── */}
      {seriesDeleteModal && (
        <div style={{
          position:'fixed', inset:0, zIndex:600,
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={()=>setSeriesDeleteModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:C.surface, borderRadius:24, padding:28,
            width:'min(380px,100%)', boxShadow:'0 24px 64px rgba(0,0,0,0.35)',
          }}>
            {/* Icon + title */}
            <div style={{textAlign:'center', marginBottom:20}}>
              <div style={{fontSize:36, marginBottom:10}}>🗓️</div>
              <div style={{fontFamily:"'Playfair Display'", fontSize:19, color:C.text, marginBottom:6}}>
                Delete recurring event
              </div>
              <div style={{fontSize:13, color:C.textMid, lineHeight:1.5}}>
                <strong style={{color:C.text}}>"{seriesDeleteModal.title?.replace(/^💑\s?/,'')}"</strong> is part of a series.
                <br/>What would you like to delete?
              </div>
            </div>
            {/* Options */}
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button onClick={()=>handleDeleteOne(seriesDeleteModal)} style={{
                background:C.bg, border:`1.5px solid ${C.border}`,
                borderRadius:14, padding:'14px 18px', cursor:'pointer',
                textAlign:'left', fontFamily:'inherit', transition:'all 0.15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rose+'88';e.currentTarget.style.background=C.rose+'08'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.bg}}
              >
                <div style={{fontSize:14, fontWeight:700, color:C.text, marginBottom:3}}>
                  🗑 This event only
                </div>
                <div style={{fontSize:12, color:C.textDim}}>
                  Delete only {seriesDeleteModal.date} — keep the rest of the series
                </div>
              </button>
              <button onClick={()=>handleDeleteSeries(seriesDeleteModal)} style={{
                background:C.rose+'08', border:`1.5px solid ${C.rose}44`,
                borderRadius:14, padding:'14px 18px', cursor:'pointer',
                textAlign:'left', fontFamily:'inherit', transition:'all 0.15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.rose+'18';e.currentTarget.style.borderColor=C.rose+'88'}}
                onMouseLeave={e=>{e.currentTarget.style.background=C.rose+'08';e.currentTarget.style.borderColor=C.rose+'44'}}
              >
                <div style={{fontSize:14, fontWeight:700, color:C.rose, marginBottom:3}}>
                  🗑 Entire series
                </div>
                <div style={{fontSize:12, color:C.textDim}}>
                  Delete all events in this recurring series
                </div>
              </button>
              <button onClick={()=>setSeriesDeleteModal(null)} style={{
                background:'none', border:'none', borderRadius:14, padding:'10px',
                cursor:'pointer', fontSize:13, color:C.textDim, fontFamily:'inherit', fontWeight:600,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          zIndex:500, pointerEvents:'none',
          background: toast.type==='success' ? C.mint : C.rose,
          color:'#fff', borderRadius:40,
          padding:'12px 24px', fontSize:13, fontWeight:700,
          boxShadow:`0 8px 32px ${toast.type==='success' ? C.mint : C.rose}66`,
          display:'flex', alignItems:'center', gap:8,
          animation:'slideUp 0.25s ease',
          whiteSpace:'nowrap',
        }}>
          {toast.type==='success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

      </main>
      </div>{/* end main wrapper */}
    </div>
  )
}