/**
 * secretMigration.js - The Secret item type was removed; existing secrets
 * become plain Notes.
 *
 * A secret's text is a second ciphertext inside its (already encrypted)
 * content, so only an unlocked device can open it: the conversion runs here,
 * once per session after unlock, not on the server. It covers archived and
 * binned secrets too, and is safe to repeat (converted items are no longer
 * secrets). A secret in a read-only space is refused by the database and left
 * for a later run, once the space allows editing.
 */
import { supabase } from './supabase'
import { decryptItem, encryptItem } from './dataProtection'
import { decryptString } from './crypto/cipher'

/** A Note's content from a secret's content (its nested ciphertext opened). */
export async function secretToNoteContent(content, cryptoKey) {
  const cipher = typeof content?.cipher === 'string' ? content.cipher : ''
  return { text: cipher ? await decryptString(cipher, cryptoKey) : '' }
}

let ranThisSession = false

/**
 * Convert this account's secrets into Notes. Runs once per session; returns how
 * many were converted (0 when there were none or it already ran).
 */
export async function convertSecretsToNotes(cryptoKey) {
  if (ranThisSession || !cryptoKey) return 0
  ranThisSession = true

  const { data, error } = await supabase
    .from('space_items')
    .select('id, title, content')
    .eq('type', 'secret')
  if (error) {
    ranThisSession = false // try again next time (e.g. offline)
    return 0
  }

  let converted = 0
  for (const row of data || []) {
    try {
      const item = await decryptItem(row, cryptoKey)
      const content = await secretToNoteContent(item.content, cryptoKey)
      const encrypted = await encryptItem({ title: item.title, content }, cryptoKey)
      // Only the type and body change; title and tags stay as they are.
      const { error: updateError } = await supabase
        .from('space_items')
        .update({ type: 'textbox', content: encrypted.content })
        .eq('id', row.id)
      if (!updateError) converted++
    } catch {
      // Unreadable (another vault's key) or refused: leave it for next time.
    }
  }
  return converted
}
