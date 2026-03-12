// @ts-ignore
/// <reference lib="deno.ns" />

// ─── us.cal · Daily Digest Edge Function ─────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const BREVO_API_KEY        = Deno.env.get('BREVO_API_KEY')!
// @ts-ignore
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
// @ts-ignore
const SUPABASE_SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')! 
// @ts-ignore
const FROM_EMAIL           = Deno.env.get('FROM_EMAIL')! 
// @ts-ignore
const APP_URL              = Deno.env.get('APP_URL')! 

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10) }

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
}

function timeToMins(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToTimeStr(m: number): string {
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}:${String(m % 60).padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function findFreeSlots(eventsA: any[], eventsB: any[]): string[] {
  const allBusy = [...eventsA, ...eventsB]
    .filter(e => e.start_time && e.end_time)
    .map(e => [timeToMins(e.start_time), timeToMins(e.end_time)])
    .sort((a, b) => a[0] - b[0])
  let free: [number, number][] = [[8*60, 22*60]]
  for (const [bs, be] of allBusy) {
    free = free.flatMap(([fs, fe]) => {
      if (be <= fs || bs >= fe) return [[fs, fe]]
      const r: [number,number][] = []
      if (bs > fs) r.push([fs, bs])
      if (be < fe) r.push([be, fe])
      return r
    })
  }
  return free.filter(([s,e]) => e-s >= 60).map(([s,e]) => `${minsToTimeStr(s)} – ${minsToTimeStr(e)}`)
}

function buildEmail({ recipientName, partnerName, todayStr, tomorrowStr, myToday, myTomorrow,
  partnerToday, partnerTomorrow, oursToday, oursTomorrow, freeToday, countdowns, appUrl }: any): string {

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const todayDate    = new Date(todayStr    + 'T12:00:00')
  const tomorrowDate = new Date(tomorrowStr + 'T12:00:00')
  const fmtDate = (d: Date) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`

  const eventRow = (ev: any, color: string) => {
    const time = ev.start_time ? `${formatTime(ev.start_time)} – ${formatTime(ev.end_time)}` : 'All day'
    const loc  = ev.location ? (() => { try { return JSON.parse(ev.location).name } catch { return ev.location } })() : ''
    return `<tr><td style="padding:6px 0;border-bottom:1px solid #f0e8dc;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:3px;height:36px;border-radius:2px;background:${color};flex-shrink:0;"></div>
        <div>
          <div style="font-weight:700;color:#3D2B1F;font-size:14px;">${ev.title}</div>
          <div style="color:#8B7355;font-size:12px;">${time}${loc ? ` · 📍 ${loc}` : ''}</div>
        </div>
      </div>
    </td></tr>`
  }

  const section = (evs: any[], color: string, emptyMsg: string) =>
    evs.length === 0
      ? `<p style="color:#B8A898;font-size:13px;margin:0 0 4px;font-style:italic;">${emptyMsg}</p>`
      : `<table style="width:100%;border-collapse:collapse;">${evs.map(e => eventRow(e, color)).join('')}</table>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#FDF6EE;font-family:'Georgia',serif;">
<div style="max-width:540px;margin:0 auto;padding:24px 16px;">

  <div style="background:linear-gradient(135deg,#4BAF84,#8B72BE);border-radius:16px;padding:28px 28px 20px;margin-bottom:20px;text-align:center;">
    <div style="font-size:32px;margin-bottom:6px;">🌿</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Good morning, ${recipientName}!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Here's your day with ${partnerName} ✨</p>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">${fmtDate(todayDate)}</p>
  </div>

  ${countdowns.length > 0 ? `
  <div style="background:#FFF8F0;border:1px solid #E8D5BC;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
    <h2 style="color:#D4920A;font-size:14px;margin:0 0 12px;">✦ Coming up soon</h2>
    ${countdowns.map((c: any) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F0E8DC;">
        <div>
          <span style="font-weight:700;color:#3D2B1F;font-size:14px;">${c.title}</span>
          <span style="color:#8B7355;font-size:12px;margin-left:8px;">${c.date}</span>
        </div>
        <div style="background:${c.days<=3?'#D4607A':c.days<=7?'#D4920A':'#4BAF84'};color:#fff;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;">
          ${c.days===0?'🎉 Today!':c.days===1?'Tomorrow!':`${c.days} days`}
        </div>
      </div>`).join('')}
  </div>` : ''}

  ${freeToday.length > 0 ? `
  <div style="background:#FFFBF0;border:1px dashed #D4920A;border-radius:12px;padding:14px 20px;margin-bottom:16px;">
    <h2 style="color:#D4920A;font-size:14px;margin:0 0 8px;">✦ You're free together today</h2>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${freeToday.map((s: string) => `<span style="background:#D4920A22;border:1px solid #D4920A55;border-radius:20px;padding:4px 12px;font-size:12px;color:#D4920A;font-weight:700;">${s}</span>`).join('')}
    </div>
    <p style="margin:10px 0 0;font-size:12px;color:#B8A898;">Plan something? <a href="${appUrl}" style="color:#D4920A;">Open us.cal →</a></p>
  </div>` : ''}

  <div style="background:#FFF8F0;border:1px solid #E8D5BC;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
    <h2 style="color:#3D2B1F;font-size:15px;margin:0 0 14px;">📅 Today · ${fmtDate(todayDate)}</h2>
    ${oursToday.length>0?`<p style="color:#8B72BE;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">💕 Together</p>${section(oursToday,'#8B72BE','')}<div style="height:10px;"></div>`:''}
    <p style="color:#4BAF84;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">🌿 ${recipientName}</p>
    ${section(myToday,'#4BAF84','Nothing scheduled — enjoy the freedom! 🌱')}
    <div style="height:10px;"></div>
    <p style="color:#D4607A;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">🌷 ${partnerName}</p>
    ${section(partnerToday.filter((e:any)=>!e.is_private),'#D4607A','Nothing scheduled 🌷')}
  </div>

  <div style="background:#FFF8F0;border:1px solid #E8D5BC;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
    <h2 style="color:#3D2B1F;font-size:15px;margin:0 0 14px;">🌅 Tomorrow · ${fmtDate(tomorrowDate)}</h2>
    ${oursTomorrow.length>0?`<p style="color:#8B72BE;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">💕 Together</p>${section(oursTomorrow,'#8B72BE','')}<div style="height:10px;"></div>`:''}
    <p style="color:#4BAF84;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">🌿 ${recipientName}</p>
    ${section(myTomorrow,'#4BAF84','Nothing scheduled tomorrow 🌱')}
    <div style="height:10px;"></div>
    <p style="color:#D4607A;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">🌷 ${partnerName}</p>
    ${section(partnerTomorrow.filter((e:any)=>!e.is_private),'#D4607A','Nothing scheduled tomorrow 🌷')}
  </div>

  <div style="text-align:center;padding:0 0 16px;">
    <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#4BAF84,#8B72BE);color:#fff;text-decoration:none;border-radius:24px;padding:12px 28px;font-weight:700;font-size:14px;">
      Open us.cal 🌿
    </a>
    <p style="color:#C4B8A8;font-size:11px;margin:14px 0 0;">
      You're receiving this because you use us.cal.<br/>
      To stop, turn off email digests in your profile settings.
    </p>
  </div>

</div>
</body></html>`
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const today    = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const todayStr    = toDateStr(today)
  const tomorrowStr = toDateStr(tomorrow)
  const in30Days    = toDateStr(new Date(Date.now() + 30*24*60*60*1000))

  const { data: partnerships, error: pErr } = await supabase.from('partnerships').select('id,user_a,user_b')
  if (pErr) return new Response(JSON.stringify({ error: pErr.message }), { status: 500 })
  if (!partnerships?.length) return new Response(JSON.stringify({ sent: 0, reason: 'No partnerships' }))

  const userIds = [...new Set(partnerships.flatMap((p:any) => [p.user_a, p.user_b]))]

  const { data: profiles } = await supabase.from('profiles').select('id,display_name,email,extras').in('id', userIds)
  const profileMap: Record<string,any> = {}
  profiles?.forEach((p:any) => profileMap[p.id] = p)

  const { data: allEvents } = await supabase.from('events').select('*')
    .in('owner_id', userIds).gte('date', todayStr).lte('date', in30Days)
    .order('date').order('start_time')
  const eventsByOwner: Record<string,any[]> = {}
  allEvents?.forEach((e:any) => { if (!eventsByOwner[e.owner_id]) eventsByOwner[e.owner_id]=[]; eventsByOwner[e.owner_id].push(e) })

  let sent = 0
  const errors: string[] = []
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  for (const partnership of partnerships) {
    for (const [meId, themId] of [[partnership.user_a, partnership.user_b],[partnership.user_b, partnership.user_a]]) {
      const me   = profileMap[meId]
      const them = profileMap[themId]
      if (!me?.email) continue
      if (me.extras?.emailDigest === false) continue

      const myEvents    = eventsByOwner[meId]   ?? []
      const theirEvents = eventsByOwner[themId] ?? []

      const myToday       = myEvents.filter((e:any)    => e.date===todayStr    && e.event_type!=='ours')
      const myTomorrow    = myEvents.filter((e:any)    => e.date===tomorrowStr && e.event_type!=='ours')
      const theirToday    = theirEvents.filter((e:any) => e.date===todayStr    && e.event_type!=='ours')
      const theirTomorrow = theirEvents.filter((e:any) => e.date===tomorrowStr && e.event_type!=='ours')

      const seen1 = new Set<string>()
      const oursToday = [...myEvents,...theirEvents].filter((e:any) => {
        if (e.event_type!=='ours'||e.date!==todayStr||seen1.has(e.id)) return false
        seen1.add(e.id); return true
      })
      const seen2 = new Set<string>()
      const oursTomorrow = [...myEvents,...theirEvents].filter((e:any) => {
        if (e.event_type!=='ours'||e.date!==tomorrowStr||seen2.has(e.id)) return false
        seen2.add(e.id); return true
      })

      const freeToday = findFreeSlots(myEvents.filter((e:any)=>e.date===todayStr), theirEvents.filter((e:any)=>e.date===todayStr))

      const countdownKeywords = /anniversary|birthday|bday|wedding|graduation|vacation|trip|holiday/i
      const seen3 = new Set<string>()
      const countdowns = [...myEvents,...theirEvents]
        .filter((e:any) => { if (e.date<=todayStr||seen3.has(e.id)) return false; seen3.add(e.id); return e.is_recurring||countdownKeywords.test(e.title) })
        .slice(0,5)
        .map((e:any) => { const d=new Date(e.date+'T12:00:00'); return { title:e.title, date:`${MONTHS[d.getMonth()]} ${d.getDate()}`, days:daysUntil(e.date) } })
        .sort((a:any,b:any) => a.days-b.days)

      const html = buildEmail({
        recipientName: me.display_name || me.email.split('@')[0],
        partnerName:   them?.display_name || 'your partner',
        todayStr, tomorrowStr,
        myToday, myTomorrow,
        partnerToday: theirToday, partnerTomorrow: theirTomorrow,
        oursToday, oursTomorrow, freeToday, countdowns, appUrl: APP_URL,
      })

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'api-key': BREVO_API_KEY },
        body: JSON.stringify({
          sender:  { email: FROM_EMAIL },
          to:      [{ email: me.email, name: me.display_name || me.email }],
          subject: `🌿 Your day with ${them?.display_name||'your partner'} — ${todayStr}`,
          htmlContent: html,
        }),
      })

      if (res.ok) { sent++ } else { errors.push(`${me.email}: ${await res.text()}`) }
    }
  }

  return new Response(JSON.stringify({ sent, errors }), { headers: { 'Content-Type':'application/json' } })
})