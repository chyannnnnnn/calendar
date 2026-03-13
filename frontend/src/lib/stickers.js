import { supabase } from './supabase'

// ─── Calendar Stickers ────────────────────────────────────────────────────────
// Stored in Supabase `calendar_stickers` table:
//   id, partnership_id, date (YYYY-MM-DD), sticker_type ('emoji'|'image'),
//   sticker_value (emoji char or base64), x (0-100), y (0-100), size (px),
//   created_by, updated_at

export async function fetchStickersForCouple(partnershipId) {
  if (!partnershipId) return []
  const { data, error } = await supabase
    .from('calendar_stickers')
    .select('*')
    .eq('partnership_id', partnershipId)
  if (error) { console.error('[stickers] fetch error', error); return [] }
  return data || []
}

export async function upsertSticker(sticker, userId, partnershipId) {
  // sticker: { id, date, type, value, x, y, size }
  const row = {
    id:             sticker.id,
    partnership_id: partnershipId,
    date:           sticker.date,
    sticker_type:   sticker.type,
    sticker_value:  sticker.value,
    x:              sticker.x,
    y:              sticker.y,
    size:           sticker.size,
    created_by:     userId,
    updated_at:     new Date().toISOString(),
  }
  const { error } = await supabase
    .from('calendar_stickers')
    .upsert(row, { onConflict: 'id' })
  if (error) console.error('[stickers] upsert error', error)
}

export async function deleteSticker(id) {
  const { error } = await supabase
    .from('calendar_stickers')
    .delete()
    .eq('id', id)
  if (error) console.error('[stickers] delete error', error)
}

export function subscribeToStickers(partnershipId, onUpdate) {
  if (!partnershipId) return () => {}
  const channel = supabase
    .channel(`stickers:${partnershipId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'calendar_stickers',
      filter: `partnership_id=eq.${partnershipId}`,
    }, onUpdate)
    .subscribe()
  return () => supabase.removeChannel(channel)
}