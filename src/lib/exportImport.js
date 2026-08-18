/**
 * exportImport.js - JSON backup export and import for ArcheSpace.
 *
 * Export produces a versioned, decrypted snapshot of the active spaces and items
 * (only the fields that define the content - no internal ids, user ids, or
 * timestamps). Import re-encrypts everything with the current vault key and
 * recreates the spaces and items; it accepts both the current versioned format
 * and the older bare-array format, validates every item type, and skips any it
 * can't recognize rather than failing the whole import.
 */

import { supabase } from './supabase'
import { logAudit } from './auditLog'
import { encryptSpace, encryptItem, decryptItems } from './dataProtection'
import { parseTags } from './spaceColors'
import {
  MAX_IMPORT_FILE_SIZE,
  MAX_IMPORT_SPACES,
  MAX_IMPORT_ITEMS_PER_SPACE,
  ITEM_TYPES,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from './constants'

const BACKUP_VERSION = 2

/**
 * Export all active spaces (and their non-deleted, non-archived items) as a
 * versioned JSON file download.
 *
 * @param {Array} spaces - The current (decrypted) spaces array
 * @param {CryptoKey} cryptoKey - Vault key for decrypting items from the DB
 */
export async function exportSpaces(spaces, cryptoKey) {
  if (!cryptoKey) throw new Error('Vault must be unlocked to export')

  try {
    const exportedSpaces = await Promise.all(
      spaces.map(async (c) => {
        const { data, error } = await supabase
          .from('space_items')
          .select('type, title, content, position, pinned')
          .eq('space_id', c.id)
          .is('deleted_at', null)
          .is('archived_at', null)
          .order('position')
        if (error) throw error

        const items = await decryptItems(data || [], cryptoKey)
        return {
          name: c.name ?? '',
          description: c.description ?? '',
          color: typeof c.color === 'string' ? c.color : null,
          tags: parseTags(c.tags),
          pinned: !!c.pinned,
          items: items.map((it) => ({
            type: it.type,
            title: it.title ?? '',
            content: it.content ?? {},
            pinned: !!it.pinned,
          })),
        }
      })
    )

    const payload = {
      app: 'ArcheSpace',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      spaces: exportedSpaces,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arche-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await logAudit({ action: 'export', details: { count: spaces.length } })
    }
  } catch (error) {
    console.error('Export failed:', error)
    throw error
  }
}

/** Validate an item's content shape for its type (matches the current editors). */
function validateItemContent(type, content) {
  if (!content || typeof content !== 'object') return false

  switch (type) {
    case 'textbox':
    case 'markdown':
      return typeof content.text === 'string'
    case 'code':
      return typeof content.code === 'string'
    case 'checkbox_list':
    case 'menu_list':
    case 'numbered_list':
    case 'card_list':
      return Array.isArray(content.items) && content.items.length <= 1000
    case 'table':
      return (
        Array.isArray(content.columns) &&
        Array.isArray(content.rows) &&
        content.columns.length <= 100 &&
        content.rows.length <= 1000
      )
    case 'draw':
      return Array.isArray(content.strokes) && content.strokes.length <= 10000
    case 'secret':
      // The body stays a nested ciphertext, only decryptable in the same vault.
      // An empty string is valid (an unset secret).
      return typeof content.cipher === 'string'
    default:
      return false
  }
}

/**
 * Import spaces from a JSON backup file. Accepts the current `{ version, spaces }`
 * format and the older bare-array format.
 *
 * @param {File} file - The .json File object from an <input>
 * @param {string} userId - The authenticated user's UUID
 * @param {CryptoKey} cryptoKey - Vault key for encrypting the imported data
 * @returns {Promise<{ spaces: number, items: number, skipped: number }>}
 * @throws {Error} If the file is malformed or exceeds the import limits
 */
export async function importSpaces(file, userId, cryptoKey) {
  if (!cryptoKey) throw new Error('Vault must be unlocked to import')
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error(`File is too large. The maximum size is ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB.`)
  }

  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch (error) {
    throw new Error('Invalid backup: the file is not valid JSON.', { cause: error })
  }

  // Current format is { version, spaces: [...] }; older backups are a bare array.
  const spacesList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.spaces)
      ? parsed.spaces
      : null
  if (!spacesList) {
    throw new Error('Invalid backup: expected a list of spaces.')
  }
  if (spacesList.length > MAX_IMPORT_SPACES) {
    throw new Error(`Too many spaces. The maximum allowed is ${MAX_IMPORT_SPACES}.`)
  }

  let itemsImported = 0
  let itemsSkipped = 0

  for (const col of spacesList) {
    if (!col || typeof col !== 'object') {
      throw new Error('Invalid backup: each space must be an object.')
    }

    const name = (typeof col.name === 'string' && col.name.trim()
      ? col.name.trim()
      : 'Imported Space'
    ).slice(0, MAX_NAME_LENGTH)
    const description = (typeof col.description === 'string' ? col.description.trim() : '')
      .slice(0, MAX_DESCRIPTION_LENGTH)

    const encryptedCol = await encryptSpace(
      { name, description, tags: parseTags(col.tags) },
      cryptoKey
    )

    const { data: newCol, error: colErr } = await supabase
      .from('spaces')
      .insert({
        name: encryptedCol.name,
        description: encryptedCol.description,
        tags: encryptedCol.tags,
        color: typeof col.color === 'string' ? col.color : null,
        pinned: !!col.pinned,
        user_id: userId,
      })
      .select()
      .single()
    if (colErr) throw colErr

    const items = Array.isArray(col.items) ? col.items : []
    if (items.length > MAX_IMPORT_ITEMS_PER_SPACE) {
      throw new Error(`Too many items in space "${name}". The maximum allowed is ${MAX_IMPORT_ITEMS_PER_SPACE}.`)
    }

    const itemsToInsert = []
    for (const item of items) {
      if (
        !item ||
        typeof item !== 'object' ||
        !ITEM_TYPES.includes(item.type) ||
        !validateItemContent(item.type, item.content)
      ) {
        itemsSkipped++
        continue
      }

      const title = (typeof item.title === 'string' ? item.title.trim() : '')
        .slice(0, MAX_TITLE_LENGTH)
      const encryptedItem = await encryptItem({ title, content: item.content }, cryptoKey)

      itemsToInsert.push({
        space_id: newCol.id,
        user_id: userId,
        type: item.type,
        title: encryptedItem.title,
        content: encryptedItem.content,
        position: itemsToInsert.length,
        pinned: !!item.pinned,
      })
    }

    if (itemsToInsert.length > 0) {
      const { error: itemErr } = await supabase.from('space_items').insert(itemsToInsert)
      if (itemErr) throw itemErr
      itemsImported += itemsToInsert.length
    }
  }

  await logAudit({
    action: 'import',
    details: { spaces_count: spacesList.length, items_count: itemsImported, items_skipped: itemsSkipped },
  })

  return { spaces: spacesList.length, items: itemsImported, skipped: itemsSkipped }
}
