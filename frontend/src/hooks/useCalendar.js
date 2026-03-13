import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { pullEvents, subscribeToEvents, watchConnectivity, startReconciliationLoop } from '../lib/sync'
import { addEvent, deleteEvent, updateEvent, deleteEventSeries } from '../lib/events'
import { useAuth } from '../lib/AuthContext'

export function useCalendar() {
  const { user, partner } = useAuth()
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline')

  useEffect(() => {
    if (!user) return

    // 1. Pull full state from Supabase on mount
    pullEvents().then(() => setSyncStatus('synced'))

    // 2. Subscribe to ALL event changes in realtime
    //    (no owner filter — catches partner deletes reliably)
    const channel = subscribeToEvents(() => setSyncStatus('synced'))

    // 3. Poll every 30s as a safety net for missed realtime events
    const stopLoop = startReconciliationLoop(() => setSyncStatus('synced'))

    // 4. Re-pull when browser comes back online
    const stopConnectivity = watchConnectivity(setSyncStatus)

    return () => {
      channel?.unsubscribe()
      stopLoop()
      stopConnectivity()
    }
  }, [user?.id, partner?.id])

  // Live query from Dexie — UI updates instantly whenever DB changes
  const allEvents = useLiveQuery(
    () => db.events.where('_syncStatus').notEqual('deleted').toArray(),
    [],
    []
  )

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

  async function removeEventSeries(seriesId) {
    setSyncStatus('syncing')
    await deleteEventSeries(seriesId)
    setSyncStatus(navigator.onLine ? 'synced' : 'offline')
  }

  return {
    events: allEvents || [],
    eventsForDate,
    eventsForRange,
    findFreeSlots,
    createEvent,
    removeEvent,
    removeEventSeries,
    updateEvent,
    syncStatus,
  }
}

function timeToMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}