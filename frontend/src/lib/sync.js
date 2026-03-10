import { supabase } from './supabase'
import { db } from './db'

// ─── Pull ─────────────────────────────────────────────────────────────────────
// Fetch ALL accessible events from Supabase (yours + partner's) and reconcile
// with local Dexie — this is the source of truth.
export async function pullEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.warn('[sync] pull failed:', error.message)
    return
  }

  // IDs that should exist locally
  const remoteIds = new Set(data.map(e => e.id))

  // Delete any local events that no longer exist remotely
  // (catches partner deletes that realtime missed)
  const localEvents = await db.events
    .where('_syncStatus').equals('synced')
    .toArray()

  const staleIds = localEvents
    .filter(e => !remoteIds.has(e.id))
    .map(e => e.id)

  if (staleIds.length) {
    await db.events.bulkDelete(staleIds)
  }

  // Upsert all remote events into local DB
  const rows = data.map(e => ({ ...e, _syncStatus: 'synced' }))
  await db.events.bulkPut(rows)
}

// ─── Push ─────────────────────────────────────────────────────────────────────
export async function flushQueue() {
  const queue = await db.syncQueue.toArray()
  if (!queue.length) return

  for (const item of queue) {
    try {
      if (item.type === 'upsert') {
        const { _syncStatus, ...event } = item.payload
        const { error } = await supabase.from('events').upsert(event)
        if (error) throw error
        await db.events.update(event.id, { _syncStatus: 'synced' })

      } else if (item.type === 'delete') {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', item.payload.id)
        if (error) throw error
        await db.events.delete(item.payload.id)
      }

      await db.syncQueue.delete(item.id)
    } catch (err) {
      console.warn('[sync] queue item failed, will retry:', err.message)
    }
  }
}

// ─── Realtime subscription ────────────────────────────────────────────────────
// Subscribe to ALL event changes (no owner filter) so deletes are never missed.
// Supabase DELETE payloads need REPLICA IDENTITY FULL to include old.id reliably,
// so we do a full pull on any DELETE rather than trusting payload.old.id.
export function subscribeToEvents(onUpdate) {
  return supabase
    .channel('all-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          // payload.old.id may be undefined without REPLICA IDENTITY FULL
          // so do a full reconciliation pull to be safe
          await pullEvents()
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          await db.events.put({ ...payload.new, _syncStatus: 'synced' })
        }
        onUpdate?.()
      }
    )
    .subscribe()
}

// ─── Periodic reconciliation ──────────────────────────────────────────────────
// Poll every 30s as a safety net — catches any changes that slipped past
// the realtime subscription (e.g. tab was in background, brief disconnect).
export function startReconciliationLoop(onUpdate) {
  const interval = setInterval(async () => {
    if (!navigator.onLine) return
    await pullEvents()
    onUpdate?.()
  }, 30_000)

  return () => clearInterval(interval)
}

// ─── Clear partner events ─────────────────────────────────────────────────────
export async function clearPartnerEvents(partnerId) {
  const ids = (await db.events.where('owner_id').equals(partnerId).toArray())
    .map(e => e.id)
  if (ids.length) await db.events.bulkDelete(ids)
}

// ─── Clear entire local DB ────────────────────────────────────────────────────
export async function clearLocalDB() {
  await db.events.clear()
  await db.syncQueue.clear()
}

// ─── Connectivity watcher ─────────────────────────────────────────────────────
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

  return () => {
    window.removeEventListener('online',  handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}