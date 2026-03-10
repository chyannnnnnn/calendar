import { db } from './db'
import { supabase } from './supabase'
import { flushQueue } from './sync'

function generateId() {
  // crypto.randomUUID() is available in all modern browsers and Node 14.17+
  return crypto.randomUUID()
}

// ─── Add event ───────────────────────────────────────────────────────────────
export async function addEvent({ title, date, startTime, endTime, isPrivate, ownerId, eventType }) {
  const event = {
    id:           generateId(),
    owner_id:     ownerId,
    title,
    date,
    start_time:   startTime,
    end_time:     endTime,
    is_private:   isPrivate ?? false,
    event_type:   eventType ?? 'mine',   // 'mine' | 'ours'
    updated_at:   new Date().toISOString(),
    created_at:   new Date().toISOString(),
    _syncStatus:  'pending',
  }

  // 1. Write locally immediately (app feels instant)
  await db.events.put(event)

  // 2. Queue for Supabase
  await db.syncQueue.add({ type: 'upsert', payload: event, createdAt: Date.now() })

  // 3. Try to flush right now if online
  if (navigator.onLine) await flushQueue()

  return event
}

// ─── Update event ─────────────────────────────────────────────────────────────
export async function updateEvent(id, changes) {
  const existing = await db.events.get(id)
  if (!existing) throw new Error('Event not found')

  const updated = {
    ...existing,
    ...changes,
    updated_at:  new Date().toISOString(),
    _syncStatus: 'pending',
  }

  await db.events.put(updated)
  await db.syncQueue.add({ type: 'upsert', payload: updated, createdAt: Date.now() })
  if (navigator.onLine) await flushQueue()

  return updated
}

// ─── Delete event ─────────────────────────────────────────────────────────────
export async function deleteEvent(id) {
  const existing = await db.events.get(id)
  if (!existing) return

  if (existing._syncStatus === 'pending') {
    // Never reached Supabase — just remove locally
    await db.events.delete(id)
  } else {
    // Mark as deleted locally, queue DELETE for Supabase
    await db.events.update(id, { _syncStatus: 'deleted' })
    await db.syncQueue.add({ type: 'delete', payload: { id }, createdAt: Date.now() })
    if (navigator.onLine) await flushQueue()
  }
}

// ─── Get events for date range ─────────────────────────────────────────────────
export async function getEventsForRange(startDate, endDate) {
  return db.events
    .where('date')
    .between(startDate, endDate, true, true)
    .and(e => e._syncStatus !== 'deleted')
    .toArray()
}