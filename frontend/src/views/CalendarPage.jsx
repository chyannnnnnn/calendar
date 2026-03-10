import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useCalendar } from '../hooks/useCalendar'

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

const USER_COLORS = {
  you:     { color:'#6EE7B7' },
  partner: { color:'#FCA5A5' },
  ours:    { color:'#C4B5FD' },  // soft purple for shared events
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user, partner, signOut, isLinked, unlinkPartner } = useAuth()
  const navigate = useNavigate()
  const { events, eventsForDate, findFreeSlots, createEvent, removeEvent, syncStatus } = useCalendar()

  const today    = new Date()
  const todayStr = toDateStr(today)

  const [calView,  setCalView]  = useState('week')
  const [navDate,  setNavDate]  = useState(new Date())
  const [tab,      setTab]      = useState('calendar')
  const [addForm,  setAddForm]  = useState({ title:'', date:'', startTime:'', endTime:'', isPrivate:false, recurring:'none', recurUntil:'', eventType:'mine', location:'', notes:'' })
  const [conflict, setConflict] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

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

  const inp = { width:'100%',background:'#1A1A20',border:'1px solid #2A2A35',borderRadius:8,padding:'10px 12px',color:'#F0EDE8',fontSize:14,outline:'none',boxSizing:'border-box',colorScheme:'dark' }

  return (
    <div style={{minHeight:'100vh',background:'#0F0F13',color:'#F0EDE8',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column'}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet"/>

      {/* ── Header ── */}
      <header style={{padding:'16px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontFamily:"'Playfair Display'",fontSize:22}}>us<span style={{color:'#6EE7B7'}}>.</span>cal</div>
          <div style={{fontSize:11,marginTop:1}}>
            {syncStatus==='synced'  && <span style={{color:'#6EE7B7'}}>● synced</span>}
            {syncStatus==='syncing' && <span style={{color:'#FCA5A580'}}>● syncing…</span>}
            {syncStatus==='offline' && <span style={{color:'#555'}}>○ offline — saved locally</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {[{key:'you',label:user?.name||'You'},{key:'partner',label:partner?.name||'Partner'}].map(u=>(
            <div key={u.key} style={{display:'flex',alignItems:'center',gap:5,background:'#1A1A20',borderRadius:20,padding:'5px 11px',fontSize:11,color:USER_COLORS[u.key].color}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:USER_COLORS[u.key].color}}/>
              {u.label}
            </div>
          ))}
          {isLinked && (
            <button onClick={handleUnlink} title="Unlink partner" style={{background:'none',border:'1px solid #2A2A35',color:'#555',fontSize:11,cursor:'pointer',borderRadius:20,padding:'4px 10px'}}>
              unlink
            </button>
          )}
          <button onClick={signOut} style={{background:'none',border:'none',color:'#333',fontSize:11,cursor:'pointer'}}>sign out</button>
        </div>
      </header>

      {/* ── Not linked banner ── */}
      {!isLinked && (
        <div style={{margin:'12px 24px 0',background:'#1A1A20',border:'1px solid #2A2A28',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#888',display:'flex',alignItems:'center',gap:10}}>
          <span>👋 Connect with your partner to see shared availability.</span>
          <button onClick={() => navigate('/connect')} style={{background:'#6EE7B7',color:'#0F0F13',border:'none',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Connect now</button>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{padding:'12px 24px 0',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',background:'#1A1A20',borderRadius:20,padding:3,gap:2}}>
          {['day','week','month'].map(v=>(
            <button key={v} onClick={()=>setCalView(v)} style={{
              background:calView===v?'#2A2A35':'transparent',
              color:calView===v?'#F0EDE8':'#555',
              border:'none',borderRadius:17,padding:'5px 13px',
              fontSize:12,fontWeight:calView===v?600:400,cursor:'pointer',
              textTransform:'capitalize',transition:'all 0.15s',
            }}>{v}</button>
          ))}
        </div>
        <button onClick={()=>navCal(-1)} style={{background:'#1A1A20',border:'none',color:'#777',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:15}}>‹</button>
        <span style={{fontFamily:"'Playfair Display'",fontSize:14,minWidth:160,textAlign:'center'}}>{navLabel}</span>
        <button onClick={()=>navCal(1)}  style={{background:'#1A1A20',border:'none',color:'#777',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:15}}>›</button>
        <button onClick={()=>setNavDate(new Date())} style={{background:'#1A1A20',border:'none',color:'#6EE7B7',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:11}}>Today</button>
      </div>

      {/* ── Tabs ── */}
      <div style={{padding:'10px 24px 0',display:'flex',gap:4}}>
        {[['calendar','Calendar'],['free','✦ Free Together'],['add','+ Add Event']].map(([v,label])=>(
          <button key={v} onClick={()=>setTab(v)} style={{
            background:tab===v?'#6EE7B7':'#1A1A20',
            color:tab===v?'#0F0F13':'#777',
            border:'none',borderRadius:20,padding:'6px 14px',
            fontSize:12,fontWeight:tab===v?600:400,cursor:'pointer',transition:'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Main content ── */}
      <main style={{flex:1,padding:'14px 24px',overflowY:'auto'}}>

        {/* ════ CALENDAR TAB ════ */}
        {tab==='calendar' && (
          <>
            {/* MONTH VIEW */}
            {calView==='month' && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
                  {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'#444',padding:'3px 0',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                  {monthDates.map(({date,inMonth},i)=>{
                    const ds=toDateStr(date), isToday=ds===todayStr
                    const dayEvs=eventsForDate(ds)
                    const freeSlots=findFreeSlots(ds)
                    return (
                      <div key={i} onClick={()=>inMonth&&goToDay(date)} style={{
                        background:isToday?'#161620':'#13131A',
                        border:`1px solid ${isToday?'#6EE7B740':'#1A1A22'}`,
                        borderRadius:7,padding:'7px 6px',minHeight:72,
                        opacity:inMonth?1:0.25,cursor:inMonth?'pointer':'default',
                      }}>
                        <div style={{fontSize:12,fontFamily:"'Playfair Display'",color:isToday?'#6EE7B7':'#F0EDE8',marginBottom:3}}>{date.getDate()}</div>
                        {dayEvs.slice(0,2).map(ev=>(
                          <div key={ev.id} style={{
                            background:eventColor(ev)+'22',
                            borderLeft:`2px solid ${eventColor(ev)}`,
                            borderRadius:3,padding:'1px 4px',marginBottom:2,
                            fontSize:9,color:eventColor(ev),
                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                          }}>{eventLabel(ev)}</div>
                        ))}
                        {dayEvs.length>2&&<div style={{fontSize:8,color:'#444'}}>+{dayEvs.length-2}</div>}
                        {inMonth&&freeSlots.length>0&&<div style={{fontSize:8,color:'#6EE7B7',marginTop:2}}>✦</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView==='week' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8}}>
                {weekDates.map((date,i)=>{
                  const ds=toDateStr(date), isToday=ds===todayStr
                  const dayEvs=eventsForDate(ds)
                  const freeSlots=findFreeSlots(ds)
                  return (
                    <div key={i} style={{background:isToday?'#161620':'#13131A',border:`1px solid ${isToday?'#6EE7B740':'#1E1E28'}`,borderRadius:12,padding:'11px 9px',minHeight:120}}>
                      <div style={{fontSize:10,color:'#555',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[date.getDay()]}</div>
                      <div onClick={()=>goToDay(date)} style={{fontSize:19,fontFamily:"'Playfair Display'",color:isToday?'#6EE7B7':'#F0EDE8',marginBottom:7,cursor:'pointer'}}>{date.getDate()}</div>
                      {dayEvs.map(ev=>(
                        <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{
                          background:eventColor(ev)+'22',
                          borderLeft:`2px solid ${eventColor(ev)}`,
                          borderRadius:4,padding:'2px 5px',marginBottom:2,
                          fontSize:9,color:eventColor(ev),
                          display:'flex',justifyContent:'space-between',alignItems:'center',
                          cursor:'pointer',
                        }}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:60}}>{eventLabel(ev)}</span>
                          {canDelete(ev)&&<span onClick={e=>{e.stopPropagation();handleDelete(ev)}} style={{cursor:'pointer',opacity:0.35,flexShrink:0,fontSize:8,marginLeft:2}}>✕</span>}
                        </div>
                      ))}
                      {freeSlots.length>0&&<div style={{marginTop:3,fontSize:8,color:'#6EE7B7',background:'#6EE7B722',borderRadius:4,padding:'2px 4px'}}>✦ {freeSlots.length} free</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* DAY VIEW */}
            {calView==='day' && (
              <div>
                <div style={{marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{fontFamily:"'Playfair Display'",fontSize:22,color:navDateStr===todayStr?'#6EE7B7':'#F0EDE8'}}>
                    {DAYS[navDate.getDay()]}, {MONTHS[navDate.getMonth()]} {navDate.getDate()}
                  </div>
                  {navDateStr===todayStr&&<span style={{fontSize:10,color:'#6EE7B7',background:'#6EE7B722',padding:'2px 8px',borderRadius:10}}>Today</span>}
                </div>
                <div style={{display:'flex',gap:10,marginBottom:10}}>
                  {['you','partner'].map(u=>(
                    <div key={u} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:USER_COLORS[u].color}}>
                      <div style={{width:7,height:7,borderRadius:2,background:USER_COLORS[u].color}}/>
                      {u==='you'?user?.name||'You':partner?.name||'Partner'}
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#6EE7B7'}}>
                    <div style={{width:7,height:7,borderRadius:2,background:'#6EE7B733',border:'1px solid #6EE7B766'}}/>Free together
                  </div>
                </div>
                <div style={{background:'#13131A',borderRadius:12,overflow:'hidden',border:'1px solid #1E1E28'}}>
                  {HOUR_ROWS.map(hour=>{
                    const dayEvs=eventsForDate(navDateStr)
                    const freeSlots=findFreeSlots(navDateStr)
                    const isFree=freeSlots.some(([s,e])=>s<=hour*60&&e>=(hour+1)*60)
                    const hourEvs=dayEvs.filter(e=>timeToMins(e.start_time)<(hour+1)*60&&timeToMins(e.end_time)>hour*60&&timeToMins(e.start_time)>=hour*60)
                    return (
                      <div key={hour} style={{display:'flex',minHeight:50,borderBottom:'1px solid #1A1A22',background:isFree?'#6EE7B708':'transparent'}}>
                        <div style={{width:44,flexShrink:0,padding:'5px 7px',fontSize:9,color:'#3A3A3A',borderRight:'1px solid #1A1A22',textAlign:'right',paddingTop:7}}>
                          {String(hour).padStart(2,'0')}:00
                        </div>
                        <div style={{flex:1,padding:'4px 8px',display:'flex',gap:4,flexWrap:'wrap',position:'relative'}}>
                          {isFree&&<div style={{position:'absolute',right:8,top:5,fontSize:8,color:'#6EE7B7',opacity:0.5}}>✦ both free</div>}
                          {hourEvs.map(ev=>(
                            <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{
                              background:eventColor(ev)+'22',
                              borderLeft:`3px solid ${eventColor(ev)}`,
                              borderRadius:5,padding:'3px 7px',fontSize:10,color:eventColor(ev),
                              display:'flex',flexDirection:'column',gap:1,minWidth:90,cursor:'pointer',
                            }}>
                              <span style={{fontWeight:500}}>{eventLabel(ev)}</span>
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
                    <div style={{marginTop:10,background:'#6EE7B711',border:'1px solid #6EE7B733',borderRadius:9,padding:'10px 13px'}}>
                      <div style={{fontSize:10,color:'#6EE7B7',marginBottom:5,fontWeight:500}}>✦ You're both free</div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {slots.map(([s,e],i)=>(
                          <span key={i} style={{background:'#6EE7B722',color:'#6EE7B7',borderRadius:20,padding:'2px 9px',fontSize:11}}>{minsToTime(s)} – {minsToTime(e)}</span>
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
            <div style={{marginBottom:14,color:'#555',fontSize:12}}>Common free slots ≥1hr — {calView} view</div>
            {freeDays.length===0
              ? <div style={{textAlign:'center',color:'#333',padding:40,fontSize:13}}>No overlapping free time 😔<br/><span style={{fontSize:11,color:'#3A3A3A'}}>Try a different week</span></div>
              : <div style={{display:'flex',flexDirection:'column',gap:9}}>
                  {freeDays.map(({date,dateStr,slots})=>(
                    <div key={dateStr} style={{background:'#13131A',border:'1px solid #1E1E28',borderRadius:11,padding:'13px 15px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                      <div>
                        <div style={{fontFamily:"'Playfair Display'",fontSize:15,marginBottom:4}}>{DAYS[date.getDay()]} {date.getDate()} {MONTHS[date.getMonth()]}</div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                          {slots.map(([s,e],i)=><span key={i} style={{background:'#6EE7B722',color:'#6EE7B7',borderRadius:20,padding:'2px 9px',fontSize:11}}>{minsToTime(s)} – {minsToTime(e)}</span>)}
                        </div>
                      </div>
                      <button onClick={()=>{setAddForm(f=>({...f,date:dateStr}));setTab('add')}} style={{background:'#6EE7B7',color:'#0F0F13',border:'none',borderRadius:20,padding:'6px 13px',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0}}>Plan →</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ════ ADD EVENT TAB ════ */}
        {tab==='add' && (
          <div style={{maxWidth:370}}>
            <div style={{fontFamily:"'Playfair Display'",fontSize:19,marginBottom:16}}>New Event</div>

            {/* Event type — most important choice, show first */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}}>This event is</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                <button onClick={()=>setAddForm(f=>({...f,eventType:'mine',isPrivate:false}))} style={{
                  background: addForm.eventType==='mine' ? '#6EE7B722' : '#1A1A20',
                  border: `1px solid ${addForm.eventType==='mine' ? '#6EE7B7' : '#2A2A35'}`,
                  color: addForm.eventType==='mine' ? '#6EE7B7' : '#555',
                  borderRadius:10, padding:'10px 8px', cursor:'pointer', textAlign:'left',
                }}>
                  <div style={{fontSize:16,marginBottom:3}}>👤</div>
                  <div style={{fontSize:12,fontWeight:600}}>Just me</div>
                  <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Personal — no conflict check</div>
                </button>
                <button onClick={()=>setAddForm(f=>({...f,eventType:'ours',isPrivate:false}))} style={{
                  background: addForm.eventType==='ours' ? '#C4B5FD22' : '#1A1A20',
                  border: `1px solid ${addForm.eventType==='ours' ? '#C4B5FD' : '#2A2A35'}`,
                  color: addForm.eventType==='ours' ? '#C4B5FD' : '#555',
                  borderRadius:10, padding:'10px 8px', cursor:'pointer', textAlign:'left',
                }}>
                  <div style={{fontSize:16,marginBottom:3}}>💑</div>
                  <div style={{fontSize:12,fontWeight:600}}>For us</div>
                  <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Warns if partner is busy</div>
                </button>
              </div>
            </div>

            {[['Title','text','title', addForm.eventType==='ours' ? 'e.g. Dinner date' : 'e.g. Gym'],['Date','date','date',''],['Start time','time','startTime',''],['End time','time','endTime','']].map(([label,type,field,ph])=>(
              <div key={field} style={{marginBottom:11}}>
                <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>{label}</label>
                <input type={type} placeholder={ph} value={addForm[field]} onChange={e=>setAddForm(f=>({...f,[field]:e.target.value}))} style={inp}/>
              </div>
            ))}

            {/* Location + Notes */}
            <div style={{marginBottom:11}}>
              <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Location <span style={{color:'#333',textTransform:'none',letterSpacing:0}}>(optional)</span></label>
              <input type="text" placeholder="e.g. Straits Quay, Penang" value={addForm.location} onChange={e=>setAddForm(f=>({...f,location:e.target.value}))} style={inp}/>
            </div>
            <div style={{marginBottom:11}}>
              <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Notes <span style={{color:'#333',textTransform:'none',letterSpacing:0}}>(optional)</span></label>
              <textarea placeholder="Any details, reminders…" value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} rows={2} style={{...inp,resize:'vertical',fontFamily:'inherit'}}/>
            </div>

            {/* Recurring */}
            <div style={{marginBottom:11}}>
              <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Repeat</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                {[['none','Once'],['daily','Daily'],['weekly','Weekly'],['biweekly','Every 2 wks'],['monthly','Monthly']].map(([val,label])=>(
                  <button key={val} onClick={()=>setAddForm(f=>({...f,recurring:val}))} style={{
                    background: addForm.recurring===val ? '#6EE7B733' : '#1A1A20',
                    border: `1px solid ${addForm.recurring===val ? '#6EE7B7' : '#2A2A35'}`,
                    color: addForm.recurring===val ? '#6EE7B7' : '#666',
                    borderRadius:7, padding:'7px 4px', fontSize:11, cursor:'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {addForm.recurring !== 'none' && (
              <div style={{marginBottom:11,background:'#1A1A20',borderRadius:8,padding:'10px 12px',border:'1px solid #2A2A35'}}>
                <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}}>Repeat until</label>
                <input type="date" value={addForm.recurUntil} onChange={e=>setAddForm(f=>({...f,recurUntil:e.target.value}))} style={{...inp,marginBottom:0,background:'transparent',border:'none',padding:'0'}}/>
                {addForm.date && addForm.recurUntil && (
                  <div style={{fontSize:10,color:'#6EE7B7',marginTop:6}}>
                    → {getRecurringDates(addForm.date, addForm.recurring, addForm.recurUntil).length} events will be created
                  </div>
                )}
              </div>
            )}

            {/* Private toggle — only for personal events */}
            {addForm.eventType === 'mine' && (
              <label style={{display:'flex',alignItems:'center',gap:7,marginBottom:16,cursor:'pointer',fontSize:12,color:'#666'}}>
                <input type="checkbox" checked={addForm.isPrivate} onChange={e=>setAddForm(f=>({...f,isPrivate:e.target.checked}))} style={{accentColor:'#6EE7B7'}}/>
                Keep details private (partner sees "Busy")
              </label>
            )}

            <button onClick={handleAdd} disabled={saving} style={{
              width:'100%',
              background: addForm.eventType==='ours' ? '#C4B5FD' : '#6EE7B7',
              color:'#0F0F13', border:'none', borderRadius:9, padding:12,
              fontSize:14, fontWeight:600, cursor:'pointer',
              opacity:saving?0.6:1,
            }}>
              {saving ? 'Saving…' : addForm.recurring !== 'none' && addForm.recurUntil
                ? `Create ${getRecurringDates(addForm.date,addForm.recurring,addForm.recurUntil).length} events`
                : addForm.eventType==='ours' ? '💑 Add shared event' : 'Add Event'}
            </button>
          </div>
        )}

        {/* ── Event detail modal ── */}
        {selectedEvent && (() => {
          const ev = selectedEvent
          const color = eventColor(ev)
          const isOurs = ev.event_type === 'ours' || ev.title?.startsWith('💑')
          const isPrivatePartner = ev.is_private && ownerOf(ev) === 'partner'
          return (
            <div onClick={()=>setSelectedEvent(null)} style={{position:'fixed',inset:0,background:'#000B',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
              <div onClick={e=>e.stopPropagation()} style={{
                background:'#13131A',border:`1px solid ${color}44`,
                borderRadius:16,padding:24,maxWidth:360,width:'100%',
              }}>
                {/* Header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
                      <span style={{fontSize:10,color:color,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                        {isOurs ? '💑 For us' : ownerOf(ev)==='you' ? user?.name||'You' : partner?.name||'Partner'}
                      </span>
                    </div>
                    <div style={{fontFamily:"'Playfair Display'",fontSize:20,color:'#F0EDE8',lineHeight:1.2}}>
                      {isPrivatePartner ? '🔒 Busy' : ev.title}
                    </div>
                  </div>
                  <button onClick={()=>setSelectedEvent(null)} style={{background:'none',border:'none',color:'#444',fontSize:18,cursor:'pointer',padding:'0 4px'}}>✕</button>
                </div>

                {/* Details */}
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#888'}}>
                    <span style={{fontSize:16}}>📅</span>
                    <span>{DAYS[new Date(ev.date+'T00:00').getDay()]}, {MONTHS[new Date(ev.date+'T00:00').getMonth()]} {new Date(ev.date+'T00:00').getDate()}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#888'}}>
                    <span style={{fontSize:16}}>🕐</span>
                    <span>{ev.start_time} – {ev.end_time}</span>
                  </div>
                  {!isPrivatePartner && ev.location && (
                    <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#888'}}>
                      <span style={{fontSize:16}}>📍</span>
                      <span>{ev.location}</span>
                    </div>
                  )}
                  {!isPrivatePartner && ev.notes && (
                    <div style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:13,color:'#888'}}>
                      <span style={{fontSize:16,flexShrink:0}}>📝</span>
                      <span style={{lineHeight:1.5}}>{ev.notes}</span>
                    </div>
                  )}
                  {ev.is_private && ownerOf(ev)==='you' && (
                    <div style={{fontSize:11,color:'#555',background:'#1A1A20',borderRadius:6,padding:'5px 9px'}}>
                      🔒 Hidden from partner
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canDelete(ev) && (
                  <button onClick={()=>handleDelete(ev)} style={{
                    width:'100%',marginTop:20,background:'#FCA5A511',
                    color:'#FCA5A5',border:'1px solid #FCA5A533',
                    borderRadius:9,padding:10,fontSize:13,cursor:'pointer',
                  }}>
                    {isOurs ? '🗑 Delete for both of us' : '🗑 Delete event'}
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Conflict modal ── */}
        {conflict&&(
          <div style={{position:'fixed',inset:0,background:'#000A',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
            <div style={{background:'#1A1A20',border:'1px solid #FCA5A5',borderRadius:14,padding:24,maxWidth:310,width:'90%'}}>
              <div style={{fontFamily:"'Playfair Display'",fontSize:17,marginBottom:7,color:'#FCA5A5'}}>⚠ Schedule Clash</div>
              <p style={{fontSize:12,color:'#888',lineHeight:1.6,marginBottom:14}}>
                "<b style={{color:'#F0EDE8'}}>{conflict.form.title}</b>" overlaps with your partner's "<b style={{color:'#FCA5A5'}}>{conflict.clash.title}</b>" ({conflict.clash.start_time}–{conflict.clash.end_time}).
              </p>
              <div style={{display:'flex',gap:7}}>
                <button onClick={commitAdd} style={{flex:1,background:'#FCA5A522',color:'#FCA5A5',border:'1px solid #FCA5A544',borderRadius:7,padding:8,fontSize:12,cursor:'pointer'}}>Add anyway</button>
                <button onClick={()=>setConflict(null)} style={{flex:1,background:'#6EE7B7',color:'#0F0F13',border:'none',borderRadius:7,padding:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Go back</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <style>{`* { box-sizing:border-box } input[type=date]::-webkit-calendar-picker-indicator, input[type=time]::-webkit-calendar-picker-indicator { filter:invert(0.4) }`}</style>
    </div>
  )
}