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
import { secretToNoteContent } from './secretMigration'
import { isRichDoc } from './richText/doc'
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
 * @param {{ confirmLocked?: () => Promise<boolean> }} [options] - Asked before
 *   a backup that includes locked items is saved (the vault PIN); resolving
 *   false cancels the export, which then returns false.
 * @returns {Promise<boolean>} Whether the backup was saved
 */
export async function exportSpaces(spaces, cryptoKey, { confirmLocked } = {}) {
  if (!cryptoKey) throw new Error('Vault must be unlocked to export')

  // Active items of one space, or the dashboard's items (no space) for `null`.
  const loadItems = async (spaceId) => {
    let q = supabase
      .from('space_items')
      .select('type, title, content, position, pinned, locked')
    q = spaceId ? q.eq('space_id', spaceId) : q.is('space_id', null)
    const { data, error } = await q
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('position')
    if (error) throw error
    const items = await decryptItems(data || [], cryptoKey)
    return items.map((it) => ({
      type: it.type,
      title: it.title ?? '',
      content: it.content ?? {},
      pinned: !!it.pinned,
      // Only written when set, so older app versions read the file unchanged.
      ...(it.locked ? { locked: true } : {}),
    }))
  }

  try {
    const exportedSpaces = await Promise.all(
      spaces.map(async (c) => ({
        name: c.name ?? '',
        description: c.description ?? '',
        color: typeof c.color === 'string' ? c.color : null,
        tags: parseTags(c.tags),
        pinned: !!c.pinned,
        ...(c.locked ? { locked: true } : {}),
        items: await loadItems(c.id),
      }))
    )

    const payload = {
      app: 'ArcheSpace',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      spaces: exportedSpaces,
      // Items that live on the dashboard, outside any space. Optional: older
      // backups don't have it, and older app versions ignore it.
      items: await loadItems(null),
    }

    // The file holds everything readable, so locked spaces and items need the
    // PIN first.
    const hasLocked = exportedSpaces.some(s => s.locked) ||
      [...payload.items, ...exportedSpaces.flatMap(s => s.items)].some(it => it.locked)
    if (hasLocked && confirmLocked && !(await confirmLocked())) return false

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
    return true
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
    case 'richtext':
      // Tiptap JSON, or the older HTML (converted after import).
      return isRichDoc(content) || typeof content.html === 'string'
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
    default:
      return false
  }
}

/**
 * Validate, re-encrypt and insert a backup's items into a space, or onto the
 * dashboard when `spaceId` is null. Items with an unknown type or a malformed
 * body are skipped rather than failing the import.
 * @returns {Promise<{ imported: number, skipped: number }>}
 */
async function insertImportedItems(items, spaceId, userId, cryptoKey) {
  let skipped = 0
  const rows = []
  for (const raw of items) {
    // Secrets (a removed type) come in as Notes when they're from this vault;
    // one sealed to another vault can't be opened, so it's skipped.
    let item = raw
    if (raw?.type === 'secret') {
      try {
        item = { ...raw, type: 'textbox', content: await secretToNoteContent(raw.content, cryptoKey) }
      } catch {
        skipped++
        continue
      }
    }
    if (
      !item ||
      typeof item !== 'object' ||
      !ITEM_TYPES.includes(item.type) ||
      !validateItemContent(item.type, item.content)
    ) {
      skipped++
      continue
    }

    // Markdown (a removed type) comes in as Rich text. The converter pulls in
    // the editor, so it only loads for a backup that has Markdown notes.
    if (item.type === 'markdown') {
      try {
        const { toRichDoc } = await import('./richText/convert')
        item = { ...item, type: 'richtext', content: { doc: toRichDoc('markdown', item.content) } }
      } catch {
        skipped++
        continue
      }
    }

    const title = (typeof item.title === 'string' ? item.title.trim() : '')
      .slice(0, MAX_TITLE_LENGTH)
    const encryptedItem = await encryptItem({ title, content: item.content }, cryptoKey)

    rows.push({
      space_id: spaceId,
      user_id: userId,
      type: item.type,
      title: encryptedItem.title,
      content: encryptedItem.content,
      position: rows.length,
      pinned: !!item.pinned,
      locked: item.locked === true,
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('space_items').insert(rows)
    if (error) throw error
  }
  return { imported: rows.length, skipped }
}

/**
 * Import spaces from a JSON backup file. Accepts the current `{ version, spaces }`
 * format (plus an optional top-level `items` list of dashboard items) and the
 * older bare-array format.
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
        locked: col.locked === true,
        user_id: userId,
      })
      .select()
      .single()
    if (colErr) throw colErr

    const items = Array.isArray(col.items) ? col.items : []
    if (items.length > MAX_IMPORT_ITEMS_PER_SPACE) {
      throw new Error(`Too many items in space "${name}". The maximum allowed is ${MAX_IMPORT_ITEMS_PER_SPACE}.`)
    }
    const result = await insertImportedItems(items, newCol.id, userId, cryptoKey)
    itemsImported += result.imported
    itemsSkipped += result.skipped
  }

  // Dashboard items (outside any space), present in newer backups only.
  if (!Array.isArray(parsed) && Array.isArray(parsed?.items)) {
    if (parsed.items.length > MAX_IMPORT_ITEMS_PER_SPACE) {
      throw new Error(`Too many dashboard items. The maximum allowed is ${MAX_IMPORT_ITEMS_PER_SPACE}.`)
    }
    const result = await insertImportedItems(parsed.items, null, userId, cryptoKey)
    itemsImported += result.imported
    itemsSkipped += result.skipped
  }

  await logAudit({
    action: 'import',
    details: { spaces_count: spacesList.length, items_count: itemsImported, items_skipped: itemsSkipped },
  })

  return { spaces: spacesList.length, items: itemsImported, skipped: itemsSkipped }
}
