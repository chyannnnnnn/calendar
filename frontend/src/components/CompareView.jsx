import { useState, useMemo, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useAuth } from '../lib/AuthContext'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const HOURS  = Array.from({length:16}, (_,i) => i + 7) // 7am–10pm
const DAY_START = 7 * 60
const DAY_MINS  = HOURS.length * 60
const ROW_H     = 36 // px per hour row
const TOTAL_H   = ROW_H * HOURS.length

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function timeToMins(t) { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m }
function minsToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}` }
function pct(mins)       { return ((mins - DAY_START) / DAY_MINS) * 100 }
function heightPct(s, e) { return Math.max(((e - s) / DAY_MINS) * 100, 1.8) }

function getDatesInRange(from, to) {
  const dates = [], end = new Date(to)
  let cur = new Date(from)
  while (cur <= end) { dates.push(new Date(cur)); cur = addDays(cur, 1) }
  return dates
}

function findFreeTogether(youEvs, partnerEvs) {
  const dayStart = 8*60, dayEnd = 22*60
  const allBusy = [...youEvs, ...partnerEvs]
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

// ─── Single day card: two half-columns + shared overlay ──────────────────────
function DayCard({ date, events, userId, partnerId, colors, C, onSelectEvent, onAddEvent }) {
  const ds      = toDateStr(date)
  const isToday = ds === toDateStr(new Date())

  const youEvs     = events.filter(e => e.date===ds && e.owner_id===userId    && e.event_type!=='ours')
  const partEvs    = events.filter(e => e.date===ds && e.owner_id===partnerId && e.event_type!=='ours')
  const oursEvs    = events.filter(e => e.date===ds && e.event_type==='ours')
  const freeSlots  = findFreeTogether(
    events.filter(e=>e.date===ds && e.owner_id===userId),
    events.filter(e=>e.date===ds && e.owner_id===partnerId)
  )

  return (
    <div style={{display:'flex',flexDirection:'column',minWidth:120}}>
      {/* Header */}
      <div style={{
        padding:'5px 4px 4px', textAlign:'center',
        background: isToday ? C.peach+'22' : C.surface,
        border:`1px solid ${isToday?C.peach+'66':C.border}`,
        borderRadius:'10px 10px 0 0', borderBottom:'none',
      }}>
        <div style={{fontFamily:"'Playfair Display'",fontSize:18,fontWeight:600,color:isToday?C.peach:C.text,lineHeight:1}}>
          {date.getDate()}
        </div>
        <div style={{fontSize:9,color:C.textDim}}>{DAYS[date.getDay()]} · {MONTHS[date.getMonth()]}</div>
        {freeSlots.length > 0 && (
          <div style={{fontSize:8,color:C.gold,fontWeight:700,marginTop:2}}>✦ {freeSlots.length} free</div>
        )}
      </div>

      {/* Sub-headers: You | Partner */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderLeft:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`}}>
        <div style={{fontSize:8,fontWeight:700,color:colors.you,textAlign:'center',padding:'2px 0',background:colors.you+'12',borderRight:`1px solid ${C.border}`}}>
          You
        </div>
        <div style={{fontSize:8,fontWeight:700,color:colors.partner,textAlign:'center',padding:'2px 0',background:colors.partner+'12'}}>
          Partner
        </div>
      </div>

      {/* Timeline body — single container, ours events span full width */}
      <div style={{
        position:'relative',
        height: TOTAL_H,
        border:`1px solid ${C.border}`,
        borderTop:'none',
        borderRadius:'0 0 10px 10px',
        overflow:'hidden',
        background:C.bg,
      }}>
        {/* Hour lines */}
        {HOURS.map((h,i) => (
          <div key={h} style={{
            position:'absolute',left:0,right:0,
            top: i * ROW_H,
            borderTop:`1px solid ${C.border}33`,
            pointerEvents:'none',
          }}/>
        ))}

        {/* Centre divider */}
        <div style={{
          position:'absolute', top:0, bottom:0, left:'50%',
          width:1, background:C.border+'88',
          pointerEvents:'none', zIndex:1,
        }}/>

        {/* Free-together bands — full width */}
        {freeSlots.map(([s,e],i) => (
          <div key={i}
            onClick={()=>onAddEvent({date:ds,startTime:minsToTime(s),endTime:minsToTime(e),eventType:'ours'})}
            style={{
              position:'absolute', left:'4%', right:'4%',
              top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
              background:C.gold+'14', border:`1px dashed ${C.gold}55`,
              borderRadius:4, zIndex:2, cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}
          >
            <span style={{fontSize:7,color:C.gold,fontWeight:700}}>✦ free together</span>
          </div>
        ))}

        {/* YOUR events — left half only */}
        {youEvs.map(ev => {
          const s=timeToMins(ev.start_time), e=timeToMins(ev.end_time)
          return (
            <div key={ev.id}
              onClick={()=>onSelectEvent(ev)}
              style={{
                position:'absolute',
                left:'2%', width:'44%',
                top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
                background:colors.you+'28', border:`1.5px solid ${colors.you}88`,
                borderLeft:`3px solid ${colors.you}`,
                borderRadius:4, padding:'1px 4px',
                cursor:'pointer', zIndex:3, overflow:'hidden',
              }}
            >
              <div style={{fontSize:8,fontWeight:700,color:colors.you,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ev.is_private ? '🔒' : ev.title}
              </div>
              <div style={{fontSize:7,color:colors.you,opacity:0.7}}>{ev.start_time}</div>
            </div>
          )
        })}

        {/* PARTNER events — right half only */}
        {partEvs.map(ev => {
          const s=timeToMins(ev.start_time), e=timeToMins(ev.end_time)
          return (
            <div key={ev.id}
              onClick={()=>onSelectEvent(ev)}
              style={{
                position:'absolute',
                right:'2%', width:'44%',
                top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
                background:colors.partner+'28', border:`1.5px solid ${colors.partner}88`,
                borderRight:`3px solid ${colors.partner}`,
                borderRadius:4, padding:'1px 4px',
                cursor:'pointer', zIndex:3, overflow:'hidden',
              }}
            >
              <div style={{fontSize:8,fontWeight:700,color:colors.partner,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ev.title}
              </div>
              <div style={{fontSize:7,color:colors.partner,opacity:0.7}}>{ev.start_time}</div>
            </div>
          )
        })}

        {/* OURS events — full width overlay spanning BOTH columns */}
        {oursEvs.map(ev => {
          const s=timeToMins(ev.start_time), e=timeToMins(ev.end_time)
          return (
            <div key={ev.id}
              onClick={()=>onSelectEvent(ev)}
              style={{
                position:'absolute',
                left:'8%', right:'8%',
                top:`${pct(s)}%`, height:`${heightPct(s,e)}%`,
                background:`linear-gradient(90deg, ${colors.you}33 0%, ${C.lavender}44 50%, ${colors.partner}33 100%)`,
                border:`2px solid ${C.lavender}99`,
                borderRadius:6, padding:'2px 6px',
                cursor:'pointer', zIndex:4, overflow:'hidden',
                display:'flex', alignItems:'center', justifyContent:'center',
                backdropFilter:'blur(2px)',
              }}
            >
              <div style={{fontSize:9,fontWeight:700,color:C.lavender,textAlign:'center',lineHeight:1.3}}>
                💕 {ev.title}
              </div>
            </div>
          )
        })}

        {/* Tap empty space to add event */}
        <div onClick={()=>onAddEvent({date:ds})}
          style={{position:'absolute',inset:0,zIndex:0,cursor:'pointer'}}
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
  const [fromDate, setFromDate] = useState(toDateStr(today))
  const [toDate,   setToDate]   = useState(toDateStr(addDays(today, 4)))

  const colors = { you: C.mint, partner: C.rose }

  const dates = useMemo(() => {
    if (!fromDate || !toDate || fromDate > toDate) return []
    return getDatesInRange(new Date(fromDate), new Date(toDate)).slice(0, 14)
  }, [fromDate, toDate])

  function setRange(n) {
    setFromDate(toDateStr(today))
    setToDate(toDateStr(addDays(today, n-1)))
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>

      {/* Controls */}
      <div style={{flexShrink:0,padding:'10px 0 8px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        {/* Legend */}
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {[
            [colors.you,  user?.name||'You',    false],
            [colors.partner, partner?.name||'Partner', false],
            [C.lavender,  'Together',   false],
            [C.gold,      'Free ✦',     true],
          ].map(([color,label,dashed])=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color,fontWeight:700}}>
              <div style={{width:10,height:10,borderRadius:3,background:color+'33',border:`${dashed?'1px dashed':'1.5px solid'} ${color}`}}/>
              {label}
            </div>
          ))}
        </div>
        <div style={{flex:1}}/>
        {/* Quick ranges */}
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
        {/* Date pickers */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:11,color:C.text,outline:'none',colorScheme:C.bg==='#1C1410'?'dark':'light'}}/>
          <span style={{fontSize:11,color:C.textDim}}>→</span>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:11,color:C.text,outline:'none',colorScheme:C.bg==='#1C1410'?'dark':'light'}}/>
        </div>
      </div>

      {/* Scrollable grid */}
      <div style={{flex:1,overflowX:'auto',overflowY:'auto',minHeight:0}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:`32px repeat(${Math.max(dates.length,1)}, minmax(130px,1fr))`,
          gap:6,
          minWidth: 32 + dates.length * 136,
          alignItems:'start',
        }}>
          {/* Hour labels */}
          <div style={{position:'relative',height:TOTAL_H+58,paddingTop:58}}>
            {HOURS.map((h,i)=>(
              <div key={h} style={{
                position:'absolute', right:4,
                top: 58 + i*ROW_H,
                fontSize:8, color:C.textDim, fontWeight:700, lineHeight:1,
                transform:'translateY(-50%)',
              }}>{h}</div>
            ))}
          </div>

          {/* Day cards */}
          {dates.length===0 ? (
            <div style={{gridColumn:'2/-1',display:'flex',alignItems:'center',justifyContent:'center',height:200,color:C.textDim,fontSize:13}}>
              Pick a date range above
            </div>
          ) : dates.map(d => (
            <DayCard
              key={toDateStr(d)}
              date={d}
              events={events}
              userId={user?.id}
              partnerId={partner?.id}
              colors={colors}
              C={C}
              onSelectEvent={onSelectEvent}
              onAddEvent={onAddEvent}
            />
          ))}
        </div>
      </div>

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