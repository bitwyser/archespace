import { supabase } from './supabase'
import { encryptSpace } from './dataProtection'

/**
 * Duplicate a space and its active items.
 * @returns {Promise<object>} Decrypted new space row
 */
export async function duplicateSpaceWithItems(source, cryptoKey, position) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const encCol = await encryptSpace({
    name: `${source.name} (copy)`,
    description: source.description || '',
    tags: source.tags || [],
  }, cryptoKey)

  const { data: newCol, error: colErr } = await supabase
    .from('spaces')
    .insert({
      name: encCol.name,
      description: encCol.description,
      user_id: userId,
      position,
      color: source.color,
      tags: encCol.tags,
      pinned: false,
      // A copy of a protected space stays protected.
      locked: !!source.locked,
    })
    .select()
    .single()
  if (colErr) throw colErr

  const { data: items, error: itemsErr } = await supabase
    .from('space_items')
    .select('type, title, content, position, pinned, locked')
    .eq('space_id', source.id)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position')
  if (itemsErr) throw itemsErr

  if (items?.length) {
    const { error: insertErr } = await supabase.from('space_items').insert(
      items.map((item, i) => ({
        space_id: newCol.id,
        user_id: userId,
        type: item.type,
        title: item.title,
        content: item.content,
        position: i,
        pinned: item.pinned,
        locked: !!item.locked,
      }))
    )
    if (insertErr) throw insertErr
  }

  return newCol
}
