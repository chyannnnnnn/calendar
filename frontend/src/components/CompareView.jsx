import { useState, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useAuth } from '../lib/AuthContext'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const HOURS  = Array.from({length:16}, (_,i) => i + 7) // 7am–10pm

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function toInputDate(d) { return toDateStr(d) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function timeToMins(t) { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m }
function minsToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}` }

function getDatesInRange(from, to) {
  const dates = []
  let cur = new Date(from)
  const end = new Date(to)
  while (cur <= end) { dates.push(new Date(cur)); cur = addDays(cur, 1) }
  return dates
}

function findFreeTogether(youEvents, partnerEvents) {
  const dayStart = 8*60, dayEnd = 22*60
  const allBusy = [...youEvents, ...partnerEvents]
    .map(e => [timeToMins(e.start_time), timeToMins(e.end_time)])
    .sort((a,b) => a[0]-b[0])
  let free = [[dayStart, dayEnd]]
  for (const [bs,be] of allBusy) {
    free = free.flatMap(([fs,fe]) => {
      if (be<=fs||bs>=fe) return [[fs,fe]]
      const r=[]
      if (bs>fs) r.push([fs,bs])
      if (be<fe) r.push([be,fe])
      return r
    })
  }
  return free.filter(([s,e]) => e-s >= 60)
}

// ─── Single day column pair ───────────────────────────────────────────────────
function DayColumn({ date, events, partnerId, userId, C, colors, onAddEvent, onSelectEvent, isToday }) {
  const dateStr = toDateStr(date)
  const youEvs  = events.filter(e => e.date===dateStr && e.owner_id===userId && e.event_type!=='ours')
  const partEvs = events.filter(e => e.date===dateStr && e.owner_id===partnerId && e.event_type!=='ours')
  const oursEvs = events.filter(e => e.date===dateStr && e.event_type==='ours')
  const freeSlots = findFreeTogether(
    events.filter(e=>e.date===dateStr && e.owner_id===userId),
    events.filter(e=>e.date===dateStr && e.owner_id===partnerId)
  )

  const DAY_MINS = 22*60 - 7*60 // total minutes shown

  function pct(mins) { return ((mins - 7*60) / DAY_MINS) * 100 }
  function heightPct(start, end) { return ((end-start) / DAY_MINS) * 100 }

  // Build event blocks for positioning
  function buildBlocks(evList, col) {
    return evList.map(ev => {
      const s = timeToMins(ev.start_time), e = timeToMins(ev.end_time)
      return { ev, top: pct(s), height: Math.max(heightPct(s,e), 2.5), col }
    })
  }

  const youBlocks  = buildBlocks(youEvs,  'you')
  const partBlocks = buildBlocks(partEvs, 'partner')
  const oursBlocks = buildBlocks(oursEvs, 'ours')

  return (
    <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
      {/* Day header */}
      <div style={{
        padding:'8px 4px',textAlign:'center',
        background: isToday ? C.peach+'22' : C.surface,
        border:`1px solid ${isToday ? C.peach+'66' : C.border}`,
        borderRadius:'10px 10px 0 0', borderBottom:'none',
        marginBottom:0,
      }}>
        <div style={{fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>
          {DAYS[date.getDay()]}
        </div>
        <div style={{
          fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600,
          color: isToday ? C.peach : C.text, lineHeight:1.1,
        }}>{date.getDate()}</div>
        <div style={{fontSize:9,color:C.textDim}}>{MONTHS[date.getMonth()]}</div>
        {freeSlots.length > 0 && (
          <div style={{marginTop:4,fontSize:9,color:C.gold,fontWeight:700,background:C.gold+'18',borderRadius:8,padding:'2px 4px'}}>
            ✦ {freeSlots.length} free
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{
        flex:1, position:'relative',
        border:`1px solid ${C.border}`, borderRadius:'0 0 10px 10px',
        background:C.surface, overflow:'hidden',
        minHeight: HOURS.length * 36,
      }}>
        {/* Hour grid lines */}
        {HOURS.map((h,i) => (
          <div key={h} style={{
            position:'absolute', left:0, right:0,
            top:`${(i/HOURS.length)*100}%`,
            borderTop:`1px solid ${C.border}`,
            display:'flex', alignItems:'flex-start',
          }}>
            <span style={{fontSize:8,color:C.textDim,padding:'1px 3px',lineHeight:1,flexShrink:0,fontWeight:600}}>
              {h}
            </span>
          </div>
        ))}

        {/* Free-together bands */}
        {freeSlots.map(([s,e],i) => (
          <div key={i} onClick={()=>onAddEvent({date:dateStr,startTime:minsToTime(s),endTime:minsToTime(e),eventType:'ours'})}
            style={{
              position:'absolute', left:'2%', right:'2%',
              top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
              background:C.gold+'18', border:`1px dashed ${C.gold}55`,
              borderRadius:4, cursor:'pointer', zIndex:1,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
            title={`Free together ${minsToTime(s)}–${minsToTime(e)} — tap to plan!`}
          >
            <span style={{fontSize:8,color:C.gold,fontWeight:700}}>✦</span>
          </div>
        ))}

        {/* Your events — left half */}
        {youBlocks.map(({ev,top,height},i) => (
          <div key={ev.id} onClick={()=>onSelectEvent(ev)}
            style={{
              position:'absolute', left:'2%', width:'44%',
              top:`${top}%`, height:`${height}%`,
              background:colors.you+'22', border:`1.5px solid ${colors.you}66`,
              borderRadius:4, padding:'1px 3px', cursor:'pointer',
              overflow:'hidden', zIndex:2,
            }}
          >
            <div style={{fontSize:8,fontWeight:700,color:colors.you,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {ev.is_private ? '🔒' : ev.title}
            </div>
          </div>
        ))}

        {/* Partner events — right half */}
        {partBlocks.map(({ev,top,height},i) => (
          <div key={ev.id} onClick={()=>onSelectEvent(ev)}
            style={{
              position:'absolute', right:'2%', width:'44%',
              top:`${top}%`, height:`${height}%`,
              background:colors.partner+'22', border:`1.5px solid ${colors.partner}66`,
              borderRadius:4, padding:'1px 3px', cursor:'pointer',
              overflow:'hidden', zIndex:2,
            }}
          >
            <div style={{fontSize:8,fontWeight:700,color:colors.partner,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {ev.title?.replace(/^💑\s?/,'')}
            </div>
          </div>
        ))}

        {/* Shared "ours" events — full width, overlapping both */}
        {oursBlocks.map(({ev,top,height},i) => (
          <div key={ev.id} onClick={()=>onSelectEvent(ev)}
            style={{
              position:'absolute', left:'8%', right:'8%',
              top:`${top}%`, height:`${height}%`,
              background:`linear-gradient(90deg, ${colors.you}33, ${colors.partner}33)`,
              border:`1.5px solid ${C.lavender}88`,
              borderRadius:6, padding:'1px 5px', cursor:'pointer',
              overflow:'hidden', zIndex:3,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            <div style={{fontSize:8,fontWeight:700,color:C.lavender,textAlign:'center',lineHeight:1.3}}>
              💕 {ev.title?.replace(/^💑\s?/,'')}
            </div>
          </div>
        ))}

        {/* Tap empty area to add event */}
        <div
          onClick={()=>onAddEvent({date:dateStr})}
          style={{position:'absolute',inset:0,zIndex:0,cursor:'pointer'}}
          title="Tap to add event"
        />
      </div>
    </div>
  )
}

// ─── CompareView ──────────────────────────────────────────────────────────────
export default function CompareView({ events, onAddEvent, onSelectEvent }) {
  const { C } = useTheme()
  const { user, partner } = useAuth()

  const today = new Date()
  const [fromDate, setFromDate] = useState(toInputDate(today))
  const [toDate,   setToDate]   = useState(toInputDate(addDays(today, 4)))

  const colors = { you: C.mint, partner: C.rose }

  const dates = useMemo(() => {
    if (!fromDate || !toDate || fromDate > toDate) return []
    const d = getDatesInRange(new Date(fromDate), new Date(toDate))
    return d.slice(0, 14) // cap at 14 days to avoid overflow
  }, [fromDate, toDate])

  const todayStr = toDateStr(today)

  // Quick range buttons
  function setRange(days) {
    setFromDate(toInputDate(today))
    setToDate(toInputDate(addDays(today, days-1)))
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>

      {/* ── Controls ── */}
      <div style={{
        flexShrink:0, padding:'12px 0 10px',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        {/* Legend */}
        <div style={{display:'flex',gap:10,alignItems:'center',marginRight:4}}>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:colors.you,fontWeight:700}}>
            <div style={{width:10,height:10,borderRadius:3,background:colors.you+'44',border:`1.5px solid ${colors.you}`}}/>
            {user?.name||'You'}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:colors.partner,fontWeight:700}}>
            <div style={{width:10,height:10,borderRadius:3,background:colors.partner+'44',border:`1.5px solid ${colors.partner}`}}/>
            {partner?.name||'Partner'}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.lavender,fontWeight:700}}>
            <div style={{width:10,height:10,borderRadius:3,background:C.lavender+'33',border:`1.5px solid ${C.lavender}`}}/>
            Together
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.gold,fontWeight:700}}>
            <div style={{width:10,height:10,borderRadius:3,background:C.gold+'22',border:`1px dashed ${C.gold}`}}/>
            Free ✦
          </div>
        </div>

        <div style={{flex:1}}/>

        {/* Quick range */}
        <div style={{display:'flex',gap:4}}>
          {[[3,'3d'],[5,'5d'],[7,'1w'],[14,'2w']].map(([n,label])=>(
            <button key={n} onClick={()=>setRange(n)} style={{
              background: dates.length===n ? C.peach : C.surface,
              color: dates.length===n ? '#fff' : C.textDim,
              border:`1px solid ${dates.length===n ? C.peach : C.border}`,
              borderRadius:8, padding:'4px 10px', fontSize:11,
              fontWeight:dates.length===n?700:500, cursor:'pointer',
            }}>{label}</button>
          ))}
        </div>

        {/* Date range picker */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:11,color:C.text,outline:'none',colorScheme:C.bg==='#1C1410'?'dark':'light'}}/>
          <span style={{fontSize:11,color:C.textDim}}>→</span>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:11,color:C.text,outline:'none',colorScheme:C.bg==='#1C1410'?'dark':'light'}}/>
        </div>
      </div>

      {/* ── Column headers (you | partner) ── */}
      <div style={{
        flexShrink:0,
        display:'grid', gridTemplateColumns:`40px repeat(${Math.max(dates.length,1)}, 1fr)`,
        gap:6, marginBottom:0,
      }}>
        <div/> {/* spacer for hour labels */}
        {dates.map(d => (
          <div key={toDateStr(d)} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
            <div style={{fontSize:9,color:colors.you,fontWeight:700,textAlign:'center',padding:'2px 0',background:colors.you+'12',borderRadius:'4px 4px 0 0'}}>
              {user?.name?.split(' ')[0]||'You'}
            </div>
            <div style={{fontSize:9,color:colors.partner,fontWeight:700,textAlign:'center',padding:'2px 0',background:colors.partner+'12',borderRadius:'4px 4px 0 0'}}>
              {partner?.name?.split(' ')[0]||'Partner'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Timeline grid ── */}
      <div style={{flex:1,overflowX:'auto',overflowY:'auto',minHeight:0}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:`40px repeat(${Math.max(dates.length,1)}, minmax(110px, 1fr))`,
          gap:6, minWidth: 40 + dates.length * 116,
          height:'100%',
        }}>
          {/* Hour labels column */}
          <div style={{position:'relative', paddingTop:32}}>
            {HOURS.map((h,i) => (
              <div key={h} style={{
                position:'absolute', left:0, right:0,
                top: `calc(32px + ${(i/HOURS.length)*100}%)`,
                fontSize:9, color:C.textDim, fontWeight:700,
                textAlign:'right', paddingRight:4, lineHeight:1,
                transform:'translateY(-50%)',
              }}>
                {h}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dates.length === 0 ? (
            <div style={{gridColumn:'2/-1',display:'flex',alignItems:'center',justifyContent:'center',color:C.textDim,fontSize:13}}>
              Pick a date range above
            </div>
          ) : dates.map(d => {
            const ds = toDateStr(d)
            const isToday = ds === todayStr
            return (
              <div key={ds} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,position:'relative'}}>
                {/* Day header spanning both cols */}
                <div style={{
                  gridColumn:'1/-1',
                  padding:'4px 0', textAlign:'center',
                  background: isToday ? C.peach+'22' : C.surface,
                  border:`1px solid ${isToday?C.peach+'66':C.border}`,
                  borderRadius:'8px 8px 0 0', borderBottom:'none',
                }}>
                  <span style={{fontFamily:"'Playfair Display'",fontSize:16,fontWeight:600,color:isToday?C.peach:C.text}}>
                    {d.getDate()}
                  </span>
                  <span style={{fontSize:9,color:C.textDim,marginLeft:4}}>
                    {DAYS[d.getDay()]} · {MONTHS[d.getMonth()]}
                  </span>
                  {(() => {
                    const fs = findFreeTogether(
                      events.filter(e=>e.date===ds&&e.owner_id===user?.id),
                      events.filter(e=>e.date===ds&&e.owner_id===partner?.id)
                    )
                    return fs.length>0 ? (
                      <span style={{marginLeft:5,fontSize:9,color:C.gold,fontWeight:700}}>✦{fs.length}</span>
                    ) : null
                  })()}
                </div>

                {/* You column */}
                <TimelineColumn
                  events={events.filter(e=>e.date===ds&&(e.owner_id===user?.id||e.event_type==='ours'))}
                  ownerId={user?.id}
                  side="you"
                  dateStr={ds}
                  colors={colors}
                  C={C}
                  onSelectEvent={onSelectEvent}
                  onAddEvent={onAddEvent}
                  partnerEvents={events.filter(e=>e.date===ds&&e.owner_id===partner?.id)}
                />

                {/* Partner column */}
                <TimelineColumn
                  events={events.filter(e=>e.date===ds&&(e.owner_id===partner?.id||e.event_type==='ours'))}
                  ownerId={partner?.id}
                  side="partner"
                  dateStr={ds}
                  colors={colors}
                  C={C}
                  onSelectEvent={onSelectEvent}
                  onAddEvent={onAddEvent}
                  partnerEvents={events.filter(e=>e.date===ds&&e.owner_id===user?.id)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* No partner message */}
      {!partner && (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg+'cc',zIndex:5,borderRadius:12,flexDirection:'column',gap:10}}>
          <div style={{fontSize:32}}>🌷</div>
          <div style={{fontFamily:"'Playfair Display'",fontSize:17,color:C.text}}>No partner linked yet</div>
          <div style={{fontSize:13,color:C.textDim}}>Connect with your partner to compare calendars</div>
        </div>
      )}
    </div>
  )
}

// ─── Single timeline column (you OR partner) ──────────────────────────────────
function TimelineColumn({ events, ownerId, side, dateStr, colors, C, onSelectEvent, onAddEvent, partnerEvents }) {
  const color    = colors[side]
  const DAY_MINS = HOURS.length * 60
  const DAY_START= 7 * 60

  function pct(mins)       { return ((mins - DAY_START) / DAY_MINS) * 100 }
  function heightPct(s, e) { return Math.max(((e - s) / DAY_MINS) * 100, 1.5) }

  const myEvents   = events.filter(e => e.event_type !== 'ours' && e.owner_id === ownerId)
  const oursEvents = events.filter(e => e.event_type === 'ours')

  // Free slots for THIS column vs partner
  const myBusy      = events.filter(e=>e.owner_id===ownerId).map(e=>[timeToMins(e.start_time),timeToMins(e.end_time)])
  const partnerBusy = (partnerEvents||[]).map(e=>[timeToMins(e.start_time),timeToMins(e.end_time)])
  const freeSlots   = findFreeTogether(
    events.filter(e=>e.owner_id===ownerId),
    partnerEvents||[]
  )

  return (
    <div style={{
      position:'relative',
      background:C.bg,
      border:`1px solid ${C.border}`,
      borderTop:'none',
      borderRadius:'0 0 8px 8px',
      minHeight: HOURS.length * 36,
      cursor:'pointer',
      overflow:'hidden',
    }}
      onClick={()=>onAddEvent({date:dateStr, eventType: side==='you'?'mine':'ours'})}
    >
      {/* Hour grid */}
      {HOURS.map((h,i) => (
        <div key={h} style={{
          position:'absolute', left:0, right:0,
          top:`${(i/HOURS.length)*100}%`,
          borderTop:`1px solid ${C.border}33`,
          pointerEvents:'none',
        }}/>
      ))}

      {/* Free-together bands */}
      {freeSlots.map(([s,e],i) => (
        <div key={i}
          onClick={ev=>{ev.stopPropagation();onAddEvent({date:dateStr,startTime:minsToTime(s),endTime:minsToTime(e),eventType:'ours'})}}
          style={{
            position:'absolute', left:'5%', right:'5%',
            top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
            background:C.gold+'18', border:`1px dashed ${C.gold}55`,
            borderRadius:3, zIndex:1, cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',
          }}
          title={`Free together — tap to plan`}
        >
          <span style={{fontSize:7,color:C.gold,fontWeight:700}}>✦ free</span>
        </div>
      ))}

      {/* Regular events */}
      {myEvents.map(ev => {
        const s = timeToMins(ev.start_time), e = timeToMins(ev.end_time)
        return (
          <div key={ev.id}
            onClick={evt=>{evt.stopPropagation();onSelectEvent(ev)}}
            style={{
              position:'absolute', left:'3%', right:'3%',
              top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
              background:color+'28', border:`1.5px solid ${color}77`,
              borderLeft:`3px solid ${color}`,
              borderRadius:4, padding:'1px 4px',
              cursor:'pointer', zIndex:2, overflow:'hidden',
            }}
          >
            <div style={{fontSize:8,fontWeight:700,color:color,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {ev.is_private && ev.owner_id===ownerId ? '🔒 Private' : ev.title}
            </div>
            <div style={{fontSize:7,color:color,opacity:0.75}}>{ev.start_time}–{ev.end_time}</div>
          </div>
        )
      })}

      {/* Shared "ours" events — shown in both columns */}
      {oursEvents.map(ev => {
        const s = timeToMins(ev.start_time), e = timeToMins(ev.end_time)
        return (
          <div key={ev.id}
            onClick={evt=>{evt.stopPropagation();onSelectEvent(ev)}}
            style={{
              position:'absolute', left:'8%', right:'8%',
              top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
              background:`linear-gradient(135deg,${colors.you}22,${colors.partner}22)`,
              border:`1.5px solid ${C.lavender}88`,
              borderRadius:4, padding:'1px 4px',
              cursor:'pointer', zIndex:3, overflow:'hidden',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}
          >
            <div style={{fontSize:8,fontWeight:700,color:C.lavender,textAlign:'center',lineHeight:1.3}}>
              💕 {ev.title?.replace(/^💑\s?/,'')}
            </div>
          </div>
        )
      })}
    </div>
  )
}