import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useCalendar } from '../hooks/useCalendar'
import { useTheme } from '../lib/ThemeContext'
import LocationPicker from '../components/LocationPicker'
import CompareView from '../components/CompareView'

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


// ─── Custom sticker system ────────────────────────────────────────────────────
// Stickers are stored in localStorage keyed by event id
// Each sticker is a { type: 'emoji'|'image', value: string } — but we expose
// a placeholder UI so the user can upload their own image or pick nothing.
// Default: a soft placeholder shown on each event chip.

function getStickerForEvent(id, stickers) {
  return stickers?.[id] || null
}

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

// ─── Sticker Picker Modal ─────────────────────────────────────────────────────
function StickerPicker({ onSelect, onClose, C }) {
  const PRESET_STICKERS = ['🌸','💕','🌿','✨','🍀','🌻','🎀','🫧','🍓','🧸','🌈','🎠','🦋','🍵','🌙','⭐','🫶','🎪','🌺','🍡']
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'#3D2B1F55',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:22,maxWidth:320,width:'100%',boxShadow:`0 20px 60px ${C.shadow}`}}>
        <div style={{fontFamily:"'Playfair Display'",fontSize:18,color:C.text,marginBottom:4}}>Add a sticker 🎀</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:16}}>Pick an emoji, or upload your own image</div>

        {/* Preset emoji grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:16}}>
          {PRESET_STICKERS.map(s=>(
            <button key={s} onClick={()=>onSelect({type:'emoji',value:s})} style={{
              background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,
              padding:'8px 0',fontSize:20,cursor:'pointer',transition:'all 0.15s',
            }}>{s}</button>
          ))}
        </div>

        {/* Image upload */}
        <label style={{
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          background:C.bg,border:`2px dashed ${C.border}`,borderRadius:12,
          padding:'12px',cursor:'pointer',fontSize:12,color:C.textMid,fontWeight:600,
        }}>
          <span style={{fontSize:18}}>🖼️</span> Upload your own sticker
          <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => onSelect({type:'image', value:ev.target.result})
            reader.readAsDataURL(file)
          }}/>
        </label>

        {/* Remove sticker */}
        <button onClick={()=>onSelect(null)} style={{
          width:'100%',marginTop:10,background:'none',border:`1px solid ${C.border}`,
          borderRadius:10,padding:8,fontSize:12,color:C.textDim,cursor:'pointer',
        }}>Remove sticker</button>
      </div>
    </div>
  )
}

// ─── Sticker display component ────────────────────────────────────────────────
function EventSticker({ sticker, size=16, C }) {
  if (!sticker) return (
    <div style={{
      width:size, height:size, borderRadius:4, flexShrink:0,
      border:`1.5px dashed ${C.border}`,
      background:'transparent', opacity:0.5,
    }}/>
  )
  if (sticker.type === 'image') return (
    <img src={sticker.value} alt="sticker" style={{width:size,height:size,objectFit:'cover',borderRadius:4,flexShrink:0}}/>
  )
  return <span style={{fontSize:size-2,lineHeight:1,flexShrink:0}}>{sticker.value}</span>
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user, partner, signOut, isLinked, unlinkPartner } = useAuth()
  const navigate = useNavigate()
  const { events, eventsForDate, findFreeSlots, createEvent, removeEvent, updateEvent, syncStatus } = useCalendar()
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
  const [stickers, setStickers] = useState({})          // { [eventId]: {type,value} }
  const [stickerTarget, setStickerTarget] = useState(null) // eventId being stickered
  const [confirmDelete, setConfirmDelete] = useState(null) // eventId pending quick-delete confirm
  const [menuOpen, setMenuOpen] = useState(false) // mobile hamburger menu
  const [showAddModal, setShowAddModal] = useState(false)

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

  function handleStickerSelect(sticker) {
    if (stickerTarget) {
      setStickers(prev => {
        const next = { ...prev }
        if (sticker === null) delete next[stickerTarget]
        else next[stickerTarget] = sticker
        return next
      })
    }
    setStickerTarget(null)
  }

  function canDelete(ev) {
    // Owner can always delete their own events
    // Either side can delete a shared "ours" event
    return ownerOf(ev) === 'you' || ev.event_type === 'ours'
  }

  async function handleDelete(ev) {
    setSelectedEvent(null)
    setConfirmDelete(null)
    await removeEvent(ev.id)
  }

  function quickDelete(e, ev) {
    e.stopPropagation()
    if (confirmDelete === ev.id) {
      handleDelete(ev)
    } else {
      setConfirmDelete(ev.id)
      // Auto-cancel after 3s
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
    const dates = getRecurringDates(addForm.date, addForm.recurring, addForm.recurUntil)
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
      })
    }
    setAddForm({title:'',date:'',startTime:'',endTime:'',isPrivate:false,recurring:'none',recurUntil:'',eventType:'mine',location:null,notes:''})
    setConflict(null)
    setSaving(false)
    setTab('calendar')
  }

  // ── Recurring date generator ──────────────────────────────
  function getRecurringDates(startDate, recurring, recurUntil) {
    if (!startDate) return []
    if (recurring === 'none' || !recurUntil) return [startDate]
    const dates = []
    const current = new Date(startDate)
    const until   = new Date(recurUntil)
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

          {/* Desktop: profile pills */}
          {!isMobile && (
            <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
              {[
                {key:'you',     label:user?.name||'You',        emoji:'🌿', route:'/profile?view=mine'},
                {key:'partner', label:partner?.name||'Partner', emoji:'🌷', route:'/profile?view=partner'},
              ].map(u=>(
                <button key={u.key} onClick={()=>navigate(u.route)} style={{
                  display:'flex',alignItems:'center',gap:5,
                  background:USER_COLORS[u.key].color+'12',
                  border:`1px solid ${USER_COLORS[u.key].color}44`,
                  borderRadius:20,padding:'4px 10px 4px 7px',
                  fontSize:11,color:USER_COLORS[u.key].color,
                  cursor:'pointer',fontFamily:'inherit',fontWeight:700,flexShrink:0,
                }}>
                  <span style={{width:18,height:18,borderRadius:'50%',background:USER_COLORS[u.key].color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>{u.emoji}</span>
                  {u.label}
                </button>
              ))}
            </div>
          )}

          {/* Desktop: theme + sign out */}
          {!isMobile && (
            <div style={{display:'flex',alignItems:'center',gap:1,flexShrink:0}}>
              <button onClick={toggleTheme} style={{background:'none',border:'none',cursor:'pointer',width:30,height:30,borderRadius:8,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMid}}>{mode==='light'?'🌙':'☀️'}</button>
              {isLinked && <button onClick={handleUnlink} style={{background:'none',border:'none',cursor:'pointer',padding:'0 6px',height:30,fontSize:9,color:C.textDim,fontFamily:'inherit',fontWeight:700,letterSpacing:'0.03em'}}>UNLINK</button>}
              <button onClick={signOut} style={{background:'none',border:'none',cursor:'pointer',padding:'0 6px',height:30,fontSize:9,color:C.textDim,fontFamily:'inherit',fontWeight:700,letterSpacing:'0.03em'}}>OUT</button>
            </div>
          )}

          {/* Mobile: hamburger */}
          {isMobile && (
            <button onClick={()=>setMenuOpen(m=>!m)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.textMid,fontSize:16,flexShrink:0}}>
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>

        {/* ── Mobile dropdown menu ── */}
        {isMobile && menuOpen && (
          <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,padding:'8px 12px 12px',display:'flex',flexDirection:'column',gap:6}}>
            {/* Profile pills */}
            <div style={{display:'flex',gap:6}}>
              {[
                {key:'you',     label:user?.name||'You',    emoji:'🌿', route:'/profile?view=mine'},
                {key:'partner', label:partner?.name||'Partner', emoji:'🌷', route:'/profile?view=partner'},
              ].map(u=>(
                <button key={u.key} onClick={()=>{navigate(u.route);setMenuOpen(false)}} style={{
                  flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                  background:USER_COLORS[u.key].color+'12',border:`1px solid ${USER_COLORS[u.key].color}44`,
                  borderRadius:20,padding:'7px 10px',
                  fontSize:12,color:USER_COLORS[u.key].color,cursor:'pointer',fontFamily:'inherit',fontWeight:700,
                }}>
                  {u.emoji} {u.label}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>{toggleTheme;setMenuOpen(false)}} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'7px',fontSize:13,cursor:'pointer',color:C.textMid}} onClick={toggleTheme}>
                {mode==='light'?'🌙 Dark':'☀️ Light'}
              </button>
              {isLinked && <button onClick={()=>{handleUnlink();setMenuOpen(false)}} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'7px',fontSize:11,cursor:'pointer',color:C.textDim,fontWeight:700}}>Unlink 💔</button>}
              <button onClick={signOut} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'7px',fontSize:11,cursor:'pointer',color:C.textDim,fontWeight:700}}>Sign out</button>
            </div>
          </div>
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
      <main onClick={()=>setConfirmDelete(null)} style={{flex:1,padding: isMobile ? '10px 10px' : '14px 24px',overflowY: tab==='compare'?'hidden':'auto',display:'flex',flexDirection:'column',position:'relative',zIndex:1,scrollBehavior:'smooth',WebkitOverflowScrolling:'touch'}}>

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
                    return (
                      <div key={i}
                        onClick={()=>inMonth&&goToDay(date)}
                        style={{
                          background: isToday ? C.peach+'11' : C.surface,
                          border:`1.5px solid ${isToday ? C.peach+'88' : hasOurs ? C.lavender+'55' : C.border}`,
                          borderRadius:isMobile?10:14, padding:isMobile?'8px 5px':'10px 8px',
                          minHeight:isMobile?68:90,
                          opacity:inMonth?1:0.25, cursor:inMonth?'pointer':'default',
                          transition:'all 0.15s', position:'relative', overflow:'hidden',
                        }}>
                        {isToday && <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.peach}00,${C.peach},${C.peach}00)`,borderRadius:'14px 14px 0 0'}}/>}
                        <div style={{
                          fontSize:isMobile?15:18, fontFamily:"'Playfair Display'", fontWeight:600,
                          color:isToday?C.peach:C.text, marginBottom:isMobile?3:5,
                          lineHeight:1,
                        }}>{date.getDate()}</div>
                        {dayEvs.slice(0, isMobile?1:3).map(ev=>(
                          <div key={ev.id} onClick={e=>{e.stopPropagation();setSelectedEvent(ev)}} style={{
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
                        {inMonth&&freeSlots.length>0 && <div style={{position:'absolute',bottom:4,right:5,fontSize:9,color:C.gold,fontWeight:700}}>✦</div>}
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
                <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                  {['you','partner'].map(u=>(
                    <div key={u} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:USER_COLORS[u].color,fontWeight:600}}>
                      <span style={{fontSize:13}}>{u==='you'?'🌿':'🌷'}</span>
                      {u==='you'?user?.name||'You':partner?.name||'Partner'}
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.gold,fontWeight:600}}>
                    <span style={{fontSize:13}}>✦</span>Free together
                  </div>
                </div>
                <div style={{background:C.surface,borderRadius:14,overflow:'hidden',border:`1px solid ${C.border}`}}>
                  {HOUR_ROWS.map(hour=>{
                    const dayEvs=eventsForDate(navDateStr)
                    const freeSlots=findFreeSlots(navDateStr)
                    const isFree=freeSlots.some(([s,e])=>s<=hour*60&&e>=(hour+1)*60)
                    const hourEvs=dayEvs.filter(e=>timeToMins(e.start_time)<(hour+1)*60&&timeToMins(e.end_time)>hour*60&&timeToMins(e.start_time)>=hour*60)
                    return (
                      <div key={hour} style={{display:'flex',minHeight:isMobile?52:64,borderBottom:`1px solid ${C.border}`,background:isFree?C.gold+'08':'transparent'}}>
                        <div style={{width:isMobile?44:56,flexShrink:0,padding:'8px 8px 8px 4px',fontSize:isMobile?9:11,color:C.textDim,borderRight:`1px solid ${C.border}`,textAlign:'right',fontWeight:600}}>
                          {String(hour%12||12).padStart(2,'0')}{hour<12?'am':'pm'}
                        </div>
                        <div style={{flex:1,padding:'5px 10px',display:'flex',gap:6,flexWrap:'wrap',position:'relative'}}>
                          {isFree&&<div style={{position:'absolute',right:10,top:6,fontSize:9,color:C.gold,opacity:0.6,fontWeight:700}}>✦ both free</div>}
                          {hourEvs.map(ev=>(
                            <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{
                              background:eventColor(ev)+'18',
                              border:`1px solid ${eventColor(ev)}55`,
                              borderRadius:8,padding:'4px 9px',fontSize:10,color:eventColor(ev),
                              display:'flex',flexDirection:'column',gap:2,minWidth:100,cursor:'pointer',
                            }}>
                              <span style={{fontWeight:700,display:'flex',alignItems:'center',gap:5}}>
                                <span onClick={e=>{e.stopPropagation();setStickerTarget(ev.id)}} title="Add sticker">
                                  <EventSticker sticker={stickers[ev.id]} size={16} C={C}/>
                                </span>
                                {eventLabel(ev)?.replace(/^💑\s?/,'')}
                              </span>
                              <span style={{fontSize:8,opacity:0.65}}>{ev.start_time}–{ev.end_time}</span>
                              {ev.location&&(()=>{
                                const loc=parseLocation(ev.location)
                                if(!loc?.name) return null
                                const mapsUrl=loc.lat?`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name)}`
                                return <a href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                                  style={{fontSize:8,color:C.textDim,display:'flex',alignItems:'center',gap:2,textDecoration:'none'}}
                                  onMouseEnter={e=>e.currentTarget.style.color=C.peach}
                                  onMouseLeave={e=>e.currentTarget.style.color=C.textDim}
                                >📍 {loc.name} <span style={{opacity:0.5}}>↗</span></a>
                              })()}
                              {canDelete(ev)&&(
                                <button onClick={e=>quickDelete(e,ev)} style={{
                                  background: confirmDelete===ev.id ? C.rose : C.bg,
                                  border:`1px solid ${C.rose}44`, borderRadius:6,
                                  cursor:'pointer', fontSize:10, padding:'2px 7px',
                                  color: confirmDelete===ev.id ? '#fff' : C.rose,
                                  fontWeight:700, alignSelf:'flex-end', transition:'all 0.2s',
                                  fontFamily:'inherit',
                                }}>
                                  {confirmDelete===ev.id ? '✓ sure?' : '🗑 remove'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
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
            position:'fixed', inset:0, zIndex:200,
            background:'rgba(0,0,0,0.5)',
            backdropFilter:'blur(8px)',
            display:'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent:'center',
            padding: isMobile ? '0' : '24px',
          }}>
            <div onClick={e=>e.stopPropagation()} style={{
              width:'100%', maxWidth:500,
              background:C.surface,
              borderRadius: isMobile ? '24px 24px 0 0' : 20,
              maxHeight: isMobile ? 'calc(100svh - 60px)' : 'min(800px, calc(100vh - 48px))',
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
              background: isMobile ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)',
              backdropFilter:'blur(6px)',
              display:'flex',
              alignItems: isMobile ? 'flex-end' : 'flex-start',
              justifyContent:'center',
              padding: isMobile ? '0' : '20px 24px 0',
            }}>
              <div onClick={e=>e.stopPropagation()} style={{
                width:'100%', maxWidth:480,
                background:C.surface,
                borderRadius: isMobile ? '24px 24px 0 0' : '0 0 20px 20px',
                maxHeight: isMobile ? 'calc(100vh - 96px)' : 'calc(100vh - 136px)',
                display:'flex', flexDirection:'column',
                boxShadow: isMobile ? '0 -8px 48px rgba(0,0,0,0.3)' : '0 8px 48px rgba(0,0,0,0.25)',
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

        {/* ── Sticker picker ── */}
        {stickerTarget && (
          <div onClick={()=>setStickerTarget(null)} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:20,padding:20,width:'min(340px,100%)',boxShadow:'0 16px 60px rgba(0,0,0,0.4)'}}>
              <StickerPicker onSelect={handleStickerSelect} onClose={()=>setStickerTarget(null)} C={C}/>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}