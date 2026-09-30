/**
 * richTextMigration.js - Rich text moved to the Tiptap editor, saving Tiptap
 * JSON (`{ doc }`). Items saved before it - the old Rich text (`{ html }`) and
 * the old Markdown type - are converted here, once per session after unlock.
 *
 * Content is encrypted, so only an unlocked device can convert it. It covers
 * archived and binned items too, and is safe to repeat. An item in a read-only
 * space is refused by the database and left for a later run, once the space
 * allows editing; until then it still displays (web and mobile read the old
 * formats).
 */
import { supabase } from '../supabase'
import { decryptItem, encryptItem } from '../dataProtection'
import { needsRichConversion } from './doc'

let ranThisSession = false

/** Convert older Rich text / Markdown items. Returns how many were converted. */
export async function convertLegacyRichText(cryptoKey) {
  if (ranThisSession || !cryptoKey) return 0
  ranThisSession = true

  const { data, error } = await supabase
    .from('space_items')
    .select('id, type, title, content')
    .in('type', ['richtext', 'markdown'])
  if (error) {
    ranThisSession = false // try again next time (e.g. offline)
    return 0
  }

  const pending = []
  for (const row of data || []) {
    try {
      const item = await decryptItem(row, cryptoKey)
      if (needsRichConversion(item.type, item.content)) pending.push(item)
    } catch {
      // Unreadable (another vault's key): leave it.
    }
  }
  if (pending.length === 0) return 0

  // The converter pulls in the editor, so it only loads when needed.
  const { toRichDoc } = await import('./convert')
  let converted = 0
  for (const item of pending) {
    try {
      const doc = toRichDoc(item.type, item.content)
      const encrypted = await encryptItem({ title: item.title, content: { doc } }, cryptoKey)
      // Only the type and body change; title and tags stay as they are.
      const { error: updateError } = await supabase
        .from('space_items')
        .update({ type: 'richtext', content: encrypted.content })
        .eq('id', item.id)
      if (!updateError) converted++
    } catch {
      // Refused (read-only space) or failed: left for next time.
    }
  }
  return converted
}
