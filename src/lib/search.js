/**
 * search.js - Client-side global search helpers.
 */

import { richContentToPlainText } from './richText/doc'
import { isContentHidden, isSpaceHidden } from './itemLock'
import { kanbanSearchText } from './kanban'

/** How many item matches the search dropdown renders (shared with keyboard nav). */
export const SEARCH_ITEM_DISPLAY_LIMIT = 30

/** Stable DOM id for a search-result option (combobox listbox). */
export function searchOptionId(kind, id) {
  return `search-opt-${kind}-${id}`
}

function norm(s) {
  return (s || '').toLowerCase()
}

function itemSearchText(item) {
  const parts = [item.title]
  if (Array.isArray(item.tags)) parts.push(...item.tags)
  // A protected item (or one in a protected space) is found by its title and
  // tags only: matching its content would reveal what it says.
  if (isContentHidden(item)) return norm(parts.filter(Boolean).join(' '))
  const c = item.content || {}
  if (item.type === 'textbox') parts.push(c.text)
  if (item.type === 'richtext' || item.type === 'markdown') parts.push(richContentToPlainText(item.type, c))
  if (c.items && Array.isArray(c.items)) {
    for (const row of c.items) {
      parts.push(row.text, row.title, row.description)
    }
  }
  if (item.type === 'table') {
    if (Array.isArray(c.columns)) parts.push(...c.columns)
    if (Array.isArray(c.rows)) for (const row of c.rows) if (Array.isArray(row)) parts.push(...row)
  }
  if (item.type === 'kanban') parts.push(...kanbanSearchText(c))
  return norm(parts.filter(Boolean).join(' '))
}

/**
 * @returns {{ spaces: Array, items: Array }}
 */
export function filterGlobalSearch({ spaces, items, itemMeta }, query) {
  const q = norm(query.trim())
  if (!q) return { spaces: [], items: [] }

  // A protected space is found by its name and tags; its description only
  // once it's opened.
  const matchedSpaces = spaces.filter(c =>
    norm(c.name).includes(q) ||
    (!isSpaceHidden(c.id) && norm(c.description).includes(q)) ||
    (Array.isArray(c.tags) && c.tags.some(t => norm(t).includes(q)))
  )

  const matchedItems = items.filter(item => {
    if (itemSearchText(item).includes(q)) return true
    const meta = itemMeta?.[item.id]
    if (meta && norm(meta.spaceName).includes(q)) return true
    return false
  })

  return { spaces: matchedSpaces, items: matchedItems }
}
