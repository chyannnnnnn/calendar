import { supabase } from './supabase'
import { db } from './db'

// ─── Pull ─────────────────────────────────────────────────────────────────────
// Fetch ALL accessible events from Supabase and reconcile with local Dexie.
// IMPORTANT: never overwrite rows that are locally pending — they haven't
// been pushed yet, so remote doesn't have the latest version.
export async function pullEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.warn('[sync] pull failed:', error.message)
    return
  }

  // IDs of rows still waiting to be pushed — don't overwrite these
  const pendingIds = new Set(
    (await db.events.where('_syncStatus').equals('pending').toArray())
      .map(e => e.id)
  )

  // Delete stale local rows (partner deleted something, realtime missed it)
  const remoteIds = new Set(data.map(e => e.id))
  const localSynced = await db.events.where('_syncStatus').equals('synced').toArray()
  const staleIds = localSynced.filter(e => !remoteIds.has(e.id)).map(e => e.id)
  if (staleIds.length) await db.events.bulkDelete(staleIds)

  // Upsert remote rows — but skip any that are pending locally
  const rows = data
    .filter(e => !pendingIds.has(e.id))
    .map(e => ({ ...e, _syncStatus: 'synced' }))

  if (rows.length) await db.events.bulkPut(rows)
}

// ─── Push ─────────────────────────────────────────────────────────────────────
export async function flushQueue() {
  const queue = await db.syncQueue.orderBy('createdAt').toArray()
  if (!queue.length) return

  for (const item of queue) {
    try {
      if (item.type === 'upsert') {
        // Strip local-only fields — Supabase doesn't know these columns
        const { _syncStatus, created_at, location_obj, ...payload } = item.payload

        // Use update if the row exists, insert if it's new
        // This is more explicit than upsert and avoids RLS edge cases
        const { data: existing } = await supabase
          .from('events').select('id').eq('id', payload.id).single()

        let error
        if (existing) {
          ;({ error } = await supabase
            .from('events')
            .update(payload)
            .eq('id', payload.id))
        } else {
          ;({ error } = await supabase
            .from('events')
            .insert(payload))
        }

        if (error) {
          console.error('[sync] upsert failed:', error.code, error.message, error.details)
          throw error
        }

        await db.events.update(item.payload.id, { _syncStatus: 'synced' })

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
export function subscribeToEvents(onUpdate) {
  return supabase
    .channel('all-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await pullEvents()
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Only apply remote update if we don't have a pending local edit for this row
          const local = await db.events.get(payload.new.id)
          if (!local || local._syncStatus !== 'pending') {
            await db.events.put({ ...payload.new, _syncStatus: 'synced' })
          }
        }
        onUpdate?.()
      }
    )
    .subscribe()
}

// ─── Periodic reconciliation ──────────────────────────────────────────────────
// Flush pending writes FIRST, then pull — ensures remote has our edits
// before we reconcile, so we never pull back a stale version.
export function startReconciliationLoop(onUpdate) {
  const interval = setInterval(async () => {
    if (!navigator.onLine) return
    await flushQueue()   // push our changes first
    await pullEvents()   // then pull remote state
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