/**
 * exportImport.js - Data export and import utilities for ArcheSpace.
 *
 * Provides functions to export active spaces as a JSON file,
 * and to import a JSON backup file with deep validation.
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
  MAX_TITLE_LENGTH
} from './constants'

/**
 * Export all active spaces (and their non-deleted items)
 * as a JSON file download.
 *
 * @param {Array} spaces - The current spaces array (decrypted)
 * @param {CryptoKey} cryptoKey - Vault key for decrypting items from DB
 */
export async function exportSpaces(spaces, cryptoKey) {
  if (!cryptoKey) throw new Error('Vault must be unlocked to export')

  try {
    const allData = await Promise.all(
      spaces.map(async (c) => {
        const { data, error } = await supabase
          .from('space_items')
          .select('*')
          .eq('space_id', c.id)
          .is('deleted_at', null)
          .is('archived_at', null)
          .order('position')
        
        if (error) throw error
        const items = await decryptItems(data || [], cryptoKey)
        return { ...c, items }
      })
    )

    const blob = new Blob([JSON.stringify(allData, null, 2)], {
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
      await logAudit({
        action: 'export',
        details: { count: spaces.length },
      })
    }
  } catch (error) {
    console.error('Export failed:', error)
    throw error
  }
}

/**
 * Validates the shape of item content based on its type.
 */
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
      if (!Array.isArray(content.items)) return false
      // Basic check for reasonable size to prevent massive arrays
      if (content.items.length > 1000) return false
      return true
    case 'table':
      if (!Array.isArray(content.columns) || !Array.isArray(content.rows)) return false
      if (content.columns.length > 100 || content.rows.length > 1000) return false
      return true
    case 'draw':
      if (!Array.isArray(content.strokes)) return false
      if (content.strokes.length > 10000) return false
      return true
    case 'secret':
      // The body stays a nested ciphertext; keep it as-is (only decryptable in
      // the same vault). An empty string is valid (an unset secret).
      return typeof content.cipher === 'string'
    default:
      return false
  }
}

/**
 * Import spaces from a JSON backup file.
 *
 * @param {File} file - The .json File object from an <input>
 * @param {string} userId - The authenticated user's UUID
 * @param {CryptoKey} cryptoKey - Vault key for encrypting imported data
 * @throws {Error} If the JSON is malformed or invalid
 */
export async function importSpaces(file, userId, cryptoKey) {
  if (!cryptoKey) throw new Error('Vault must be unlocked to import')
  // Validate file size
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error(`File is too large. Maximum size is ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB.`)
  }

  const text = await file.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error('Invalid backup format: Not valid JSON.', { cause: error })
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid backup format: Expected an array of spaces.')
  }

  if (parsed.length > MAX_IMPORT_SPACES) {
    throw new Error(`Too many spaces. Maximum allowed is ${MAX_IMPORT_SPACES}.`)
  }

  let totalItemsImported = 0

  for (const col of parsed) {
    if (typeof col !== 'object' || col === null) {
      throw new Error('Invalid backup format: Space must be an object.')
    }

    const { items } = col
    const colData = {
      name: col.name,
      description: col.description,
      color: col.color,
      tags: col.tags,
    }

    // Validate and sanitize space data
    let sanitizedName = typeof colData.name === 'string' ? colData.name.trim() : 'Imported Space'
    if (!sanitizedName) sanitizedName = 'Imported Space'
    colData.name = sanitizedName.slice(0, MAX_NAME_LENGTH)

    if (typeof colData.description === 'string') {
      colData.description = colData.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
    } else {
      colData.description = ''
    }

    const encryptedCol = await encryptSpace({
      name: colData.name,
      description: colData.description || '',
      tags: parseTags(colData.tags),
    }, cryptoKey)

    const { data: newCol, error: colErr } = await supabase
      .from('spaces')
      .insert({
        ...colData,
        name: encryptedCol.name,
        description: encryptedCol.description,
        tags: encryptedCol.tags,
        user_id: userId,
      })
      .select()
      .single()

    if (colErr) throw colErr

    if (Array.isArray(items) && items.length > 0) {
      if (items.length > MAX_IMPORT_ITEMS_PER_SPACE) {
        throw new Error(`Too many items in space "${colData.name}". Maximum allowed is ${MAX_IMPORT_ITEMS_PER_SPACE}.`)
      }

      const itemsToInsert = []
      for (const item of items) {
        // Validate type
        if (!ITEM_TYPES.includes(item.type)) continue

        // Validate content shape
        if (!validateItemContent(item.type, item.content)) continue

        // Sanitize title
        let sanitizedTitle = typeof item.title === 'string' ? item.title.trim() : ''
        sanitizedTitle = sanitizedTitle.slice(0, MAX_TITLE_LENGTH)

        const encryptedItem = await encryptItem({
          title: sanitizedTitle,
          content: item.content,
        }, cryptoKey)

        itemsToInsert.push({
          space_id: newCol.id,
          user_id: userId,
          type: item.type,
          title: encryptedItem.title,
          content: encryptedItem.content,
          position: typeof item.position === 'number' ? item.position : itemsToInsert.length,
          pinned: !!item.pinned
        })
      }
      
      if (itemsToInsert.length > 0) {
        // Batch insert items
        const { error: itemErr } = await supabase
          .from('space_items')
          .insert(itemsToInsert)
        if (itemErr) throw itemErr
        totalItemsImported += itemsToInsert.length
      }
    }
  }

  await logAudit({
    action: 'import',
    details: { spaces_count: parsed.length, items_count: totalItemsImported },
  })
}
