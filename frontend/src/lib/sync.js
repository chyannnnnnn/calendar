import { supabase } from './supabase'
import { db } from './db'

// ─── Pull ────────────────────────────────────────────────────────────────────
// Fetch all events (yours + partner's) from Supabase and write into Dexie.
// Called on app start and after reconnect.
export async function pullEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.warn('[sync] pull failed:', error.message)
    return
  }

  // Upsert into local DB — mark everything as 'synced'
  const rows = data.map(e => ({ ...e, _syncStatus: 'synced' }))
  await db.events.bulkPut(rows)
}

// ─── Push ────────────────────────────────────────────────────────────────────
// Flush the offline queue to Supabase.
// Each queue entry is { type: 'upsert' | 'delete', payload: eventObject }
export async function flushQueue() {
  const queue = await db.syncQueue.toArray()
  if (!queue.length) return

  for (const item of queue) {
    try {
      if (item.type === 'upsert') {
        const { _syncStatus, ...event } = item.payload
        const { error } = await supabase.from('events').upsert(event)
        if (error) throw error
        // Mark local record as synced
        await db.events.update(event.id, { _syncStatus: 'synced' })

      } else if (item.type === 'delete') {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', item.payload.id)
        if (error) throw error
        await db.events.delete(item.payload.id)
      }

      // Remove from queue on success
      await db.syncQueue.delete(item.id)
    } catch (err) {
      console.warn('[sync] queue item failed, will retry:', err.message)
      // Leave in queue — will retry next time we're online
    }
  }
}

// ─── Realtime subscription ───────────────────────────────────────────────────
// Listen for partner's changes and write them straight into Dexie.
export function subscribeToPartnerEvents(partnerId, onUpdate) {
  return supabase
    .channel('partner-events')
    .on(
      'postgres_changes',
      {
        event: '*',               // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'events',
        filter: `owner_id=eq.${partnerId}`,
      },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.events.delete(payload.old.id)
        } else {
          await db.events.put({ ...payload.new, _syncStatus: 'synced' })
        }
        onUpdate?.()
      }
    )
    .subscribe()
}

// ─── Clear partner events from local DB ──────────────────────────────────────
// Called when unlinking — removes partner's events from Dexie so they
// don't show up stale after the partnership is removed.
export async function clearPartnerEvents(partnerId) {
  const partnerEvents = await db.events
    .where('owner_id').equals(partnerId)
    .toArray()
  const ids = partnerEvents.map(e => e.id)
  if (ids.length) await db.events.bulkDelete(ids)
}

// ─── Clear entire local DB ────────────────────────────────────────────────────
// Called on sign out so the next user starts fresh.
export async function clearLocalDB() {
  await db.events.clear()
  await db.syncQueue.clear()
  await db.profiles.clear()
}
// Automatically flush queue when browser comes back online.
export function watchConnectivity(onStatusChange) {
  const handleOnline = async () => {
    onStatusChange?.('syncing')
    await flushQueue()
    await pullEvents()
    onStatusChange?.('synced')
  }
  const handleOffline = () => onStatusChange?.('offline')

  window.addEventListener('online',  handleOnline)
  window.addEventListener('offline', handleOffline)

  // Return cleanup fn
  return () => {
    window.removeEventListener('online',  handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}