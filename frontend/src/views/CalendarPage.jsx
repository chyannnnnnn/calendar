import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useCalendar } from '../hooks/useCalendar'
import { useTheme } from '../lib/ThemeContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
  const [addForm,  setAddForm]  = useState({ title:'', date:'', startTime:'', endTime:'', isPrivate:false, recurring:'none', recurUntil:'', eventType:'mine', location:'', notes:'' })
  const [conflict, setConflict] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [stickers, setStickers] = useState({})          // { [eventId]: {type,value} }
  const [stickerTarget, setStickerTarget] = useState(null) // eventId being stickered

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
      location:  ev.location || '',
      notes:     ev.notes || '',
      isPrivate: ev.is_private || false,
    })
  }

  async function handleSaveEdit() {
    if (!editForm.title || !editForm.date || !editForm.startTime || !editForm.endTime) return
    setSaving(true)
    const isOurs = selectedEvent.event_type === 'ours' || selectedEvent.title?.startsWith('💑')
    await updateEvent(selectedEvent.id, {
      title:      isOurs ? `💑 ${editForm.title}` : editForm.title,
      date:       editForm.date,
      start_time: editForm.startTime,
      end_time:   editForm.endTime,
      location:   editForm.location,
      notes:      editForm.notes,
      is_private: editForm.isPrivate,
    })
    setSelectedEvent(null)
    setEditForm(null)
    setSaving(false)
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
    await removeEvent(ev.id)
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
        location:  addForm.location,
        notes:     addForm.notes,
      })
    }
    setAddForm({title:'',date:'',startTime:'',endTime:'',isPrivate:false,recurring:'none',recurUntil:'',eventType:'mine',location:'',notes:''})
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

      {/* ── Header ── */}
      <header style={{padding:'16px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative',zIndex:1}}>
        <div>
          <div style={{fontFamily:"'Playfair Display'",fontSize:24,letterSpacing:'-0.5px'}}>
            us<span style={{color:C.peach}}>.</span>cal
            <span style={{fontSize:14,marginLeft:8,opacity:0.4}}>🌸</span>
          </div>
          <div style={{fontSize:11,marginTop:2}}>
            {syncStatus==='synced'  && <span style={{color:C.mint}}>✿ synced</span>}
            {syncStatus==='syncing' && <span style={{color:C.peach}}>✿ syncing…</span>}
            {syncStatus==='offline' && <span style={{color:C.textDim}}>○ offline — saved locally</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {[{key:'you',label:user?.name||'You',emoji:'🌿'},{key:'partner',label:partner?.name||'Partner',emoji:'🌷'}].map(u=>(
            <div key={u.key} style={{display:'flex',alignItems:'center',gap:5,background:C.surface,border:`1px solid ${USER_COLORS[u.key].color}44`,borderRadius:20,padding:'5px 12px',fontSize:11,color:USER_COLORS[u.key].color}}>
              <span style={{fontSize:12}}>{u.emoji}</span>
              {u.label}
            </div>
          ))}
          {isLinked && (
            <button onClick={handleUnlink} title="Unlink partner" style={{background:'none',border:`1px solid ${C.border}`,color:C.textDim,fontSize:11,cursor:'pointer',borderRadius:20,padding:'4px 10px'}}>
              unlink
            </button>
          )}
          <button onClick={toggleTheme} title="Toggle theme" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textMid,fontSize:15,cursor:'pointer',borderRadius:10,padding:'3px 9px'}}>{mode==='light'?'🌙':'☀️'}</button>
          <button onClick={signOut} style={{background:'none',border:'none',color:C.textDim,fontSize:11,cursor:'pointer'}}>sign out</button>
        </div>
      </header>

      {/* ── Not linked banner ── */}
      {!isLinked && (
        <div style={{margin:'12px 24px 0',background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'10px 16px',fontSize:12,color:C.textMid,display:'flex',alignItems:'center',gap:10,position:'relative',zIndex:1}}>
          <span>🌻 Connect with your partner to see shared availability.</span>
          <button onClick={() => navigate('/connect')} style={{background:C.mint,color:C.bg,border:'none',borderRadius:20,padding:'4px 14px',fontSize:11,fontWeight:700,cursor:'pointer'}}>Connect now ✨</button>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{padding:'12px 24px 0',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',position:'relative',zIndex:1}}>
        <div style={{display:'flex',background:C.surface,border:`1px solid ${C.border}`,borderRadius:22,padding:3,gap:2}}>
          {['day','week','month'].map(v=>(
            <button key={v} onClick={()=>setCalView(v)} style={{
              background:calView===v?C.peach+'33':'transparent',
              color:calView===v?C.peach:C.textDim,
              border: calView===v?`1px solid ${C.peach}55`:'1px solid transparent',
              borderRadius:17,padding:'5px 14px',
              fontSize:12,fontWeight:calView===v?700:400,cursor:'pointer',
              textTransform:'capitalize',transition:'all 0.2s',
            }}>{v}</button>
          ))}
        </div>
        <button onClick={()=>navCal(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textMid,borderRadius:10,padding:'5px 12px',cursor:'pointer',fontSize:15}}>‹</button>
        <span style={{fontFamily:"'Playfair Display'",fontSize:14,minWidth:160,textAlign:'center',color:C.text}}>{navLabel}</span>
        <button onClick={()=>navCal(1)}  style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textMid,borderRadius:10,padding:'5px 12px',cursor:'pointer',fontSize:15}}>›</button>
        <button onClick={()=>setNavDate(new Date())} style={{background:C.gold+'22',border:`1px solid ${C.gold}44`,color:C.gold,borderRadius:10,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:600}}>Today ✦</button>
      </div>

      {/* ── Tabs ── */}
      <div style={{padding:'10px 24px 0',display:'flex',gap:6,position:'relative',zIndex:1}}>
        {[['calendar','🗓 Calendar'],['free','✦ Free Together'],['add','＋ Add Event']].map(([v,label])=>(
          <button key={v} onClick={()=>setTab(v)} style={{
            background:tab===v ? (v==='add'?C.peach:C.mint) : C.surface,
            color:tab===v?C.bg:C.textMid,
            border:`1px solid ${tab===v?(v==='add'?C.peach:C.mint)+'88':C.border}`,
            borderRadius:22,padding:'7px 16px',
            fontSize:12,fontWeight:tab===v?700:400,cursor:'pointer',transition:'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Main content ── */}
      <main style={{flex:1,padding:'14px 24px',overflowY:'auto',position:'relative',zIndex:1}}>

        {/* ════ CALENDAR TAB ════ */}
        {tab==='calendar' && (
          <>
            {/* MONTH VIEW */}
            {calView==='month' && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:6}}>
                  {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:C.textDim,padding:'4px 0',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700}}>{d}</div>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
                  {monthDates.map(({date,inMonth},i)=>{
                    const ds=toDateStr(date), isToday=ds===todayStr
                    const dayEvs=eventsForDate(ds)
                    const freeSlots=findFreeSlots(ds)
                    const hasOurs = dayEvs.some(e=>e.event_type==='ours'||e.title?.startsWith('💑'))
                    return (
                      <div key={i} onClick={()=>inMonth&&goToDay(date)} style={{
                        background: isToday ? C.surfaceHi : C.surface,
                        border:`1px solid ${isToday ? C.peach+'66' : hasOurs ? C.lavender+'44' : C.border}`,
                        borderRadius:10,padding:'7px 6px',minHeight:76,
                        opacity:inMonth?1:0.2,cursor:inMonth?'pointer':'default',
                        transition:'all 0.15s',position:'relative',overflow:'hidden',
                      }}>
                        {/* corner doodle for today */}
                        {isToday && <div style={{position:'absolute',top:3,right:4,fontSize:9,opacity:0.5}}>✿</div>}
                        <div style={{fontSize:12,fontFamily:"'Playfair Display'",fontWeight:600,color:isToday?C.peach:C.text,marginBottom:3}}>{date.getDate()}</div>
                        {dayEvs.slice(0,2).map(ev=>(
                          <div key={ev.id} onClick={e=>{e.stopPropagation();setSelectedEvent(ev)}} style={{
                            background:eventColor(ev)+'18',
                            border:`1px solid ${eventColor(ev)}44`,
                            borderRadius:5,padding:'1px 5px',marginBottom:2,
                            fontSize:9,color:eventColor(ev),fontWeight:600,
                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                            display:'flex',alignItems:'center',gap:3,
                          }}>
                            <EventSticker sticker={stickers[ev.id]} size={10} C={C}/>
                            <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{eventLabel(ev)?.replace(/^💑\s?/,'')}</span>
                          </div>
                        ))}
                        {dayEvs.length>2&&<div style={{fontSize:8,color:C.textDim}}>+{dayEvs.length-2} more</div>}
                        {inMonth&&freeSlots.length>0&&<div style={{fontSize:9,color:C.gold,marginTop:2}}>✦</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView==='week' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
                {weekDates.map((date,i)=>{
                  const ds=toDateStr(date), isToday=ds===todayStr
                  const dayEvs=eventsForDate(ds)
                  const freeSlots=findFreeSlots(ds)
                  const hasOurs = dayEvs.some(e=>e.event_type==='ours'||e.title?.startsWith('💑'))
                  return (
                    <div key={i} style={{
                      background:isToday?C.surfaceHi:C.surface,
                      border:`1px solid ${isToday?C.peach+'55':hasOurs?C.lavender+'33':C.border}`,
                      borderRadius:14,padding:'11px 9px',minHeight:130,
                      position:'relative',overflow:'hidden',
                    }}>
                      {isToday && <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.peach}00,${C.peach}88,${C.peach}00)`}}/>}
                      <div style={{fontSize:10,color:C.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700}}>{DAYS[date.getDay()]}</div>
                      <div onClick={()=>goToDay(date)} style={{fontSize:20,fontFamily:"'Playfair Display'",color:isToday?C.peach:C.text,marginBottom:7,cursor:'pointer',fontWeight:600}}>{date.getDate()}</div>
                      {dayEvs.map(ev=>(
                        <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{
                          background:eventColor(ev)+'18',
                          border:`1px solid ${eventColor(ev)}44`,
                          borderRadius:7,padding:'3px 6px',marginBottom:3,
                          fontSize:9,color:eventColor(ev),fontWeight:600,
                          display:'flex',justifyContent:'space-between',alignItems:'center',
                          cursor:'pointer',transition:'all 0.15s',
                        }}>
                          <span style={{display:'flex',alignItems:'center',gap:3,overflow:'hidden'}}>
                            <span onClick={e=>{e.stopPropagation();setStickerTarget(ev.id)}} title="Add sticker">
                              <EventSticker sticker={stickers[ev.id]} size={13} C={C}/>
                            </span>
                            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:50}}>{eventLabel(ev)?.replace(/^💑\s?/,'')}</span>
                          </span>
                          {canDelete(ev)&&<span onClick={e=>{e.stopPropagation();handleDelete(ev)}} style={{cursor:'pointer',opacity:0.3,flexShrink:0,fontSize:8,marginLeft:2}}>✕</span>}
                        </div>
                      ))}
                      {freeSlots.length>0&&<div style={{marginTop:4,fontSize:8,color:C.gold,background:C.gold+'18',border:`1px solid ${C.gold}33`,borderRadius:6,padding:'2px 5px',fontWeight:600}}>✦ {freeSlots.length} free</div>}
                    </div>
                  )
                })}
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
                      <div key={hour} style={{display:'flex',minHeight:52,borderBottom:`1px solid ${C.border}`,background:isFree?C.gold+'08':'transparent'}}>
                        <div style={{width:46,flexShrink:0,padding:'5px 8px',fontSize:9,color:C.textDim,borderRight:`1px solid ${C.border}`,textAlign:'right',paddingTop:8,fontWeight:600}}>
                          {String(hour).padStart(2,'0')}:00
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
                              {canDelete(ev)&&<span onClick={e=>{e.stopPropagation();handleDelete(ev)}} style={{fontSize:8,opacity:0.35,cursor:'pointer',alignSelf:'flex-end'}}>✕ remove</span>}
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

        {/* ════ FREE TOGETHER TAB ════ */}
        {tab==='free' && (
          <div>
            <div style={{marginBottom:16,color:C.textMid,fontSize:12,fontWeight:600}}>🌟 Common free slots ≥1hr — {calView} view</div>
            {freeDays.length===0
              ? <div style={{textAlign:'center',color:C.textDim,padding:48,fontSize:13}}>
                  <div style={{fontSize:36,marginBottom:10}}>🌙</div>
                  No overlapping free time this period<br/>
                  <span style={{fontSize:11,color:C.textDim}}>Try a different week ✦</span>
                </div>
              : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {freeDays.map(({date,dateStr,slots})=>(
                    <div key={dateStr} style={{background:C.surface,border:`1px solid ${C.gold}33`,borderRadius:14,padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                      <div>
                        <div style={{fontFamily:"'Playfair Display'",fontSize:15,marginBottom:5,color:C.text,fontWeight:600}}>
                          ✨ {DAYS[date.getDay()]} {date.getDate()} {MONTHS[date.getMonth()]}
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {slots.map(([s,e],i)=><span key={i} style={{background:C.gold+'22',color:C.gold,border:`1px solid ${C.gold}44`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:600}}>{minsToTime(s)} – {minsToTime(e)}</span>)}
                        </div>
                      </div>
                      <button onClick={()=>{setAddForm(f=>({...f,date:dateStr,eventType:'ours'}));setTab('add')}} style={{background:C.peach,color:C.bg,border:'none',borderRadius:20,padding:'7px 14px',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                        Plan 💕
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ════ ADD EVENT TAB ════ */}
        {tab==='add' && (
          <div style={{maxWidth:380}}>
            <div style={{fontFamily:"'Playfair Display'",fontSize:22,marginBottom:18,color:C.text}}>New Event 🌸</div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:8,fontWeight:700}}>This event is for</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <button onClick={()=>setAddForm(f=>({...f,eventType:'mine',isPrivate:false}))} style={{
                  background: addForm.eventType==='mine' ? C.mint+'22' : C.surface,
                  border: `1px solid ${addForm.eventType==='mine' ? C.mint : C.border}`,
                  color: addForm.eventType==='mine' ? C.mint : C.textDim,
                  borderRadius:12, padding:'12px 10px', cursor:'pointer', textAlign:'left',transition:'all 0.2s',
                }}>
                  <div style={{fontSize:20,marginBottom:4}}>🌿</div>
                  <div style={{fontSize:12,fontWeight:700}}>Just me</div>
                  <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Personal — no conflict check</div>
                </button>
                <button onClick={()=>setAddForm(f=>({...f,eventType:'ours',isPrivate:false}))} style={{
                  background: addForm.eventType==='ours' ? C.lavender+'22' : C.surface,
                  border: `1px solid ${addForm.eventType==='ours' ? C.lavender : C.border}`,
                  color: addForm.eventType==='ours' ? C.lavender : C.textDim,
                  borderRadius:12, padding:'12px 10px', cursor:'pointer', textAlign:'left',transition:'all 0.2s',
                }}>
                  <div style={{fontSize:20,marginBottom:4}}>💕</div>
                  <div style={{fontSize:12,fontWeight:700}}>For us</div>
                  <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Warns if partner is busy</div>
                </button>
              </div>
            </div>

            {[['Title','text','title', addForm.eventType==='ours' ? 'e.g. Dinner date 🍽️' : 'e.g. Gym 🏃'],['Date','date','date',''],['Start time','time','startTime',''],['End time','time','endTime','']].map(([label,type,field,ph])=>(
              <div key={field} style={{marginBottom:12}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>{label}</label>
                <input type={type} placeholder={ph} value={addForm[field]} onChange={e=>setAddForm(f=>({...f,[field]:e.target.value}))} style={inp}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>📍 Location <span style={{color:C.textDim,textTransform:'none',letterSpacing:0,fontWeight:400}}>(optional)</span></label>
              <input type="text" placeholder="e.g. Straits Quay, Penang" value={addForm.location} onChange={e=>setAddForm(f=>({...f,location:e.target.value}))} style={inp}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5,fontWeight:700}}>📝 Notes <span style={{color:C.textDim,textTransform:'none',letterSpacing:0,fontWeight:400}}>(optional)</span></label>
              <textarea placeholder="Any details, reminders…" value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6,fontWeight:700}}>Repeat</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                {[['none','Once'],['daily','Daily'],['weekly','Weekly'],['biweekly','Every 2 wks'],['monthly','Monthly']].map(([val,label])=>(
                  <button key={val} onClick={()=>setAddForm(f=>({...f,recurring:val}))} style={{
                    background: addForm.recurring===val ? C.mint+'22' : C.surface,
                    border: `1px solid ${addForm.recurring===val ? C.mint : C.border}`,
                    color: addForm.recurring===val ? C.mint : C.textDim,
                    borderRadius:8, padding:'7px 4px', fontSize:11, cursor:'pointer',fontWeight:addForm.recurring===val?700:400,
                  }}>{label}</button>
                ))}
              </div>
            </div>
            {addForm.recurring !== 'none' && (
              <div style={{marginBottom:12,background:C.surface,borderRadius:10,padding:'10px 14px',border:`1px solid ${C.border}`}}>
                <label style={{fontSize:10,color:C.textMid,textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6,fontWeight:700}}>Repeat until</label>
                <input type="date" value={addForm.recurUntil} onChange={e=>setAddForm(f=>({...f,recurUntil:e.target.value}))} style={{...inp,marginBottom:0,background:'transparent',border:'none',padding:'0'}}/>
                {addForm.date && addForm.recurUntil && (
                  <div style={{fontSize:10,color:C.mint,marginTop:6,fontWeight:600}}>
                    ✿ {getRecurringDates(addForm.date, addForm.recurring, addForm.recurUntil).length} events will be created
                  </div>
                )}
              </div>
            )}
            {addForm.eventType === 'mine' && (
              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer',fontSize:12,color:C.textMid}}>
                <input type="checkbox" checked={addForm.isPrivate} onChange={e=>setAddForm(f=>({...f,isPrivate:e.target.checked}))} style={{accentColor:C.mint}}/>
                🔒 Keep private (partner sees "Busy")
              </label>
            )}
            <button onClick={handleAdd} disabled={saving} style={{
              width:'100%',
              background: addForm.eventType==='ours' ? C.lavender : C.mint,
              color:C.bg, border:'none', borderRadius:12, padding:13,
              fontSize:14, fontWeight:700, cursor:'pointer',
              opacity:saving?0.6:1, transition:'all 0.2s',
            }}>
              {saving ? '✿ Saving…' : addForm.recurring !== 'none' && addForm.recurUntil
                ? `✿ Create ${getRecurringDates(addForm.date,addForm.recurring,addForm.recurUntil).length} events`
                : addForm.eventType==='ours' ? '💕 Add shared event' : '✿ Add Event'}
            </button>
          </div>
        )}

        {/* ── Event detail / edit modal ── */}
        {selectedEvent && (() => {
          const ev = selectedEvent
          const color = eventColor(ev)
          const isOurs = ev.event_type === 'ours' || ev.title?.startsWith('💑')
          const isPrivatePartner = ev.is_private && ownerOf(ev) === 'partner'
          const editing = editForm !== null
          const minp = { width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',colorScheme:'dark',fontFamily:'inherit' }

          return (
            <div onClick={closeModal} style={{position:'fixed',inset:0,background:'#0008',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
              <div onClick={e=>e.stopPropagation()} style={{
                background:C.surface,border:`1px solid ${color}55`,
                borderRadius:20,padding:24,maxWidth:380,width:'100%',
                maxHeight:'90vh',overflowY:'auto',
                boxShadow:`0 20px 60px #00000066, 0 0 0 1px ${color}22`,
              }}>

                {/* ── Modal header ── */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                      <button onClick={()=>setStickerTarget(ev.id)} title="Change sticker" style={{
                        background:C.bg,border:`1.5px dashed ${C.border}`,borderRadius:10,
                        padding:'6px 8px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,
                        fontSize:11,color:C.textMid,
                      }}>
                        <EventSticker sticker={stickers[ev.id]} size={22} C={C}/>
                        <span style={{fontSize:9}}>+sticker</span>
                      </button>
                      <span style={{fontSize:10,color:color,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700}}>
                        {isOurs ? '💕 For us' : ownerOf(ev)==='you' ? user?.name||'You' : partner?.name||'Partner'}
                      </span>
                      {isOurs && <span style={{fontSize:9,color:C.textDim,marginLeft:2}}>— editable by both</span>}
                    </div>
                    {!editing && (
                      <div style={{fontFamily:"'Playfair Display'",fontSize:22,color:C.text,lineHeight:1.2,wordBreak:'break-word'}}>
                        {isPrivatePartner ? '🔒 Busy' : ev.title?.replace(/^💑\s?/,'')}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,marginLeft:10,flexShrink:0}}>
                    {canEdit(ev) && !isPrivatePartner && !editing && (
                      <button onClick={()=>openEdit(ev)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textMid,fontSize:12,cursor:'pointer',borderRadius:8,padding:'5px 11px',fontWeight:600}}>✏️ Edit</button>
                    )}
                    <button onClick={closeModal} style={{background:'none',border:'none',color:C.textDim,fontSize:18,cursor:'pointer',padding:'0 4px'}}>✕</button>
                  </div>
                </div>

                {/* ── VIEW MODE ── */}
                {!editing && (
                  <div style={{display:'flex',flexDirection:'column',gap:11}}>
                    <div style={{display:'flex',alignItems:'center',gap:11,fontSize:13,color:C.textMid,background:C.bg,borderRadius:10,padding:'10px 13px'}}>
                      <span style={{fontSize:16}}>📅</span>
                      <span>{DAYS[new Date(ev.date+'T00:00').getDay()]}, {MONTHS[new Date(ev.date+'T00:00').getMonth()]} {new Date(ev.date+'T00:00').getDate()}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:11,fontSize:13,color:C.textMid,background:C.bg,borderRadius:10,padding:'10px 13px'}}>
                      <span style={{fontSize:16}}>🕐</span>
                      <span>{ev.start_time} – {ev.end_time}</span>
                    </div>
                    {!isPrivatePartner && ev.location && (
                      <div style={{display:'flex',alignItems:'center',gap:11,fontSize:13,color:C.textMid,background:C.bg,borderRadius:10,padding:'10px 13px'}}>
                        <span style={{fontSize:16}}>📍</span>
                        <span>{ev.location}</span>
                      </div>
                    )}
                    {!isPrivatePartner && ev.notes && (
                      <div style={{display:'flex',alignItems:'flex-start',gap:11,fontSize:13,color:C.textMid,background:C.bg,borderRadius:10,padding:'10px 13px'}}>
                        <span style={{fontSize:16,flexShrink:0}}>📝</span>
                        <span style={{lineHeight:1.6}}>{ev.notes}</span>
                      </div>
                    )}
                    {ev.is_private && ownerOf(ev)==='you' && (
                      <div style={{fontSize:11,color:C.textDim,background:C.bg,borderRadius:8,padding:'6px 11px'}}>🔒 Hidden from partner</div>
                    )}
                    {canDelete(ev) && (
                      <button onClick={()=>handleDelete(ev)} style={{width:'100%',marginTop:4,background:C.rose+'11',color:C.rose,border:`1px solid ${C.rose}33`,borderRadius:11,padding:11,fontSize:13,cursor:'pointer',fontWeight:600}}>
                        {isOurs ? '🗑 Delete for both of us' : '🗑 Delete event'}
                      </button>
                    )}
                  </div>
                )}

                {/* ── EDIT MODE ── */}
                {editing && (
                  <div style={{display:'flex',flexDirection:'column',gap:11}}>
                    <div>
                      <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Title</label>
                      <input type="text" value={editForm.title} onChange={e=>setEditForm(f=>({...f,title:e.target.value}))} style={minp}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                      <div style={{gridColumn:'span 3'}}>
                        <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Date</label>
                        <input type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} style={minp}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Start</label>
                        <input type="time" value={editForm.startTime} onChange={e=>setEditForm(f=>({...f,startTime:e.target.value}))} style={minp}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>End</label>
                        <input type="time" value={editForm.endTime} onChange={e=>setEditForm(f=>({...f,endTime:e.target.value}))} style={minp}/>
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>📍 Location</label>
                      <input type="text" placeholder="Optional" value={editForm.location} onChange={e=>setEditForm(f=>({...f,location:e.target.value}))} style={minp}/>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>📝 Notes</label>
                      <textarea rows={2} placeholder="Optional" value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} style={{...minp,resize:'vertical',fontFamily:'inherit'}}/>
                    </div>
                    {!isOurs && (
                      <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:12,color:'#666'}}>
                        <input type="checkbox" checked={editForm.isPrivate} onChange={e=>setEditForm(f=>({...f,isPrivate:e.target.checked}))} style={{accentColor:C.mint}}/>
                        Keep private (partner sees "Busy")
                      </label>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>setEditForm(null)} style={{flex:1,background:C.bg,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:10,padding:10,fontSize:13,cursor:'pointer',fontWeight:600}}>
                        Cancel
                      </button>
                      <button onClick={handleSaveEdit} disabled={saving} style={{
                        flex:2,background:isOurs?C.lavender:C.mint,
                        color:C.bg,border:'none',borderRadius:10,padding:10,
                        fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving?0.6:1,transition:'all 0.2s',
                      }}>
                        {saving ? '✿ Saving…' : '✿ Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Conflict modal ── */}
        {conflict&&(
          <div style={{position:'fixed',inset:0,background:'#0009',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:20}}>
            <div style={{background:C.surface,border:`1px solid ${C.rose}66`,borderRadius:18,padding:26,maxWidth:320,width:'100%',boxShadow:`0 20px 60px #00000066`}}>
              <div style={{fontSize:32,marginBottom:8,textAlign:'center'}}>🌧️</div>
              <div style={{fontFamily:"'Playfair Display'",fontSize:18,marginBottom:8,color:C.rose,textAlign:'center'}}>Schedule Clash!</div>
              <p style={{fontSize:12,color:C.textMid,lineHeight:1.7,marginBottom:18,textAlign:'center'}}>
                <b style={{color:C.text}}>{conflict.form.title}</b> overlaps with your partner's <b style={{color:C.rose}}>{conflict.clash.title}</b> ({conflict.clash.start_time}–{conflict.clash.end_time}).
              </p>
              <div style={{display:'flex',gap:8}}>
                <button onClick={commitAdd} style={{flex:1,background:C.rose+'18',color:C.rose,border:`1px solid ${C.rose}44`,borderRadius:10,padding:10,fontSize:12,cursor:'pointer',fontWeight:600}}>Add anyway</button>
                <button onClick={()=>setConflict(null)} style={{flex:1,background:C.mint,color:C.bg,border:'none',borderRadius:10,padding:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>Go back 🌿</button>
              </div>
            </div>
          </div>
        )}
        {/* ── Sticker picker ── */}
        {stickerTarget && (
          <StickerPicker
            onSelect={handleStickerSelect}
            onClose={()=>setStickerTarget(null)}
            C={C}
          />
        )}

      </main>
      <style>{`
        * { box-sizing:border-box }
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=time]::-webkit-calendar-picker-indicator { filter:opacity(0.5) }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:#E8D5BC; border-radius:4px }
        * { -webkit-font-smoothing:antialiased }
        button:hover { filter:brightness(0.97) }
      `}</style>
    </div>
  )
}