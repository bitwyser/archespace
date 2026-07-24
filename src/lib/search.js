/**
 * search.js - Client-side global search helpers.
 */

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
  const c = item.content || {}
  if (item.type === 'textbox' || item.type === 'markdown') parts.push(c.text)
  if (c.items && Array.isArray(c.items)) {
    for (const row of c.items) {
      parts.push(row.text, row.title, row.description)
    }
  }
  if (item.type === 'table') {
    if (Array.isArray(c.columns)) parts.push(...c.columns)
    if (Array.isArray(c.rows)) for (const row of c.rows) if (Array.isArray(row)) parts.push(...row)
  }
  return norm(parts.filter(Boolean).join(' '))
}

/**
 * @returns {{ spaces: Array, items: Array }}
 */
export function filterGlobalSearch({ spaces, items, itemMeta }, query) {
  const q = norm(query.trim())
  if (!q) return { spaces: [], items: [] }

  const matchedSpaces = spaces.filter(c =>
    norm(c.name).includes(q) || norm(c.description).includes(q) ||
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
