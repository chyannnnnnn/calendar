import Dexie from 'dexie'

// Local IndexedDB database — the app reads from here first (offline-first).
// Supabase sync writes into this same DB so the UI never waits for network.

export const db = new Dexie('uscal')

db.version(1).stores({
  // Local copy of all events (yours + partner's)
  events: 'id, owner_id, date, updated_at, _syncStatus',

  // Queued writes that haven't reached Supabase yet (created while offline)
  syncQueue: '++id, type, payload, createdAt',

  // Cached user/partner profile info
  profiles: 'id',
})

// _syncStatus values:
//   'synced'   — exists in Supabase, no local changes
//   'pending'  — created/updated offline, not yet pushed
//   'deleted'  — deleted offline, needs DELETE sent to Supabase