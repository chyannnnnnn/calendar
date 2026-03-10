import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { pullEvents, subscribeToPartnerEvents, watchConnectivity } from '../lib/sync'
import { addEvent, deleteEvent, updateEvent } from '../lib/events'
import { useAuth } from '../lib/AuthContext'

export function useCalendar() {
  const { user, partner } = useAuth()
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline')

  // ── Bootstrap: pull from Supabase on mount ────────────────
  useEffect(() => {
    if (!user) return
    pullEvents().then(() => setSyncStatus('synced'))

    // Subscribe to partner's live changes
    let channel
    if (partner?.id) {
      channel = subscribeToPartnerEvents(partner.id, () => setSyncStatus('synced'))
    }

    // Watch connectivity
    const cleanup = watchConnectivity(setSyncStatus)

    return () => {
      cleanup()
      channel?.unsubscribe()
    }
  }, [user?.id, partner?.id])

  // ── Live query from Dexie (reactive — updates automatically) ──
  const allEvents = useLiveQuery(
    () => db.events.where('_syncStatus').notEqual('deleted').toArray(),
    [],
    []
  )

  // ── Helpers ───────────────────────────────────────────────
  function eventsForDate(dateStr) {
    return (allEvents || []).filter(e => e.date === dateStr)
  }

  function eventsForRange(startStr, endStr) {
    return (allEvents || []).filter(e => e.date >= startStr && e.date <= endStr)
  }

  function findFreeSlots(dateStr) {
    const dayEvents = eventsForDate(dateStr)
    const busy = dayEvents
      .map(e => [timeToMins(e.start_time), timeToMins(e.end_time)])
      .sort((a, b) => a[0] - b[0])

    const dayStart = 8 * 60, dayEnd = 22 * 60
    let free = [[dayStart, dayEnd]]

    for (const [bs, be] of busy) {
      free = free.flatMap(([fs, fe]) => {
        if (be <= fs || bs >= fe) return [[fs, fe]]
        const r = []
        if (bs > fs) r.push([fs, bs])
        if (be < fe) r.push([be, fe])
        return r
      })
    }

    return free.filter(([s, e]) => e - s >= 60)
  }

  async function createEvent(fields) {
    setSyncStatus('syncing')
    const ev = await addEvent({ ...fields, ownerId: user.id })
    setSyncStatus(navigator.onLine ? 'synced' : 'offline')
    return ev
  }

  async function removeEvent(id) {
    setSyncStatus('syncing')
    await deleteEvent(id)
    setSyncStatus(navigator.onLine ? 'synced' : 'offline')
  }

  return {
    events: allEvents || [],
    eventsForDate,
    eventsForRange,
    findFreeSlots,
    createEvent,
    removeEvent,
    updateEvent,
    syncStatus,
  }
}

function timeToMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}