/**
 * welcomeSpace.js - The sample space a new account starts with: a short tour
 * of spaces, items and the vault (spec/welcome-space.json, shared with the
 * mobile app).
 *
 * It's made once, when the vault is first set up, and encrypted with the new
 * vault key like anything the user writes. Accounts that already have a vault
 * never get it, and deleting it is like deleting any space.
 */
import welcome from '../../spec/welcome-space.json'
import { supabase } from './supabase'
import { encryptSpace, encryptItem } from './dataProtection'

/** A copy of an item's content with a fresh id on each list entry. */
function withEntryIds(content) {
  if (!Array.isArray(content.items)) return content
  return { ...content, items: content.items.map(entry => ({ id: crypto.randomUUID(), ...entry })) }
}

/**
 * Create the welcome space and its items. Best effort: a failure leaves the
 * account as it was (an empty dashboard), and setup carries on.
 */
export async function createWelcomeSpace(userId, key) {
  try {
    const { space, items } = welcome
    const encryptedSpace = await encryptSpace(
      { name: space.name, description: space.description, tags: space.tags },
      key
    )
    const { data: created, error } = await supabase
      .from('spaces')
      .insert({
        user_id: userId,
        name: encryptedSpace.name,
        description: encryptedSpace.description,
        tags: encryptedSpace.tags,
        color: space.color,
        pinned: space.pinned,
        position: 0,
      })
      .select('id')
      .single()
    if (error) throw error

    const rows = await Promise.all(items.map(async (item, position) => {
      const encrypted = await encryptItem({ title: item.title, content: withEntryIds(item.content), tags: [] }, key)
      return {
        space_id: created.id,
        user_id: userId,
        type: item.type,
        title: encrypted.title,
        content: encrypted.content,
        tags: encrypted.tags,
        position,
        pinned: !!item.pinned,
        // Protected: the content needs the vault PIN to open.
        locked: item.locked === true,
      }
    }))
    const { error: itemsError } = await supabase.from('space_items').insert(rows)
    if (itemsError) throw itemsError
  } catch (err) {
    console.warn("Couldn't create the welcome space:", err?.message)
  }
}
