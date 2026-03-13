import Dexie from 'dexie'

// Local IndexedDB database — the app reads from here first (offline-first).
// Supabase sync writes into this same DB so the UI never waits for network.

export const db = new Dexie('uscal')

db.version(1).stores({
  events: 'id, owner_id, date, updated_at, _syncStatus',
  syncQueue: '++id, type, payload, createdAt',
  profiles: 'id',
})

// v2 — adds series_id index for recurring event group deletes
db.version(2).stores({
  events: 'id, owner_id, date, updated_at, _syncStatus, series_id',
  syncQueue: '++id, type, payload, createdAt',
  profiles: 'id',
})

// _syncStatus values:
//   'synced'   — exists in Supabase, no local changes
//   'pending'  — created/updated offline, not yet pushed
//   'deleted'  — deleted offline, needs DELETE sent to Supabase