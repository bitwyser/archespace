/**
 * sortEntities.js - Client-side sort order for spaces and items.
 *
 * Names and titles are encrypted at rest, so they can't be ordered by the
 * database. Sorting happens here, after decryption, on the already-loaded list.
 *
 * Pinned entries always stay on top, whatever the sort, so pinning keeps its
 * meaning. "Default" preserves the manual drag order the list arrives in.
 */

export const SORT_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'name', label: 'Name' },
  { id: 'recent', label: 'Newest' },
]

export const DEFAULT_SORT = 'default'

const byName = (getName) => (a, b) =>
  (getName(a) || '').localeCompare(getName(b) || '', undefined, { sensitivity: 'base', numeric: true })

const byRecent = (a, b) =>
  new Date(b.created_at || 0) - new Date(a.created_at || 0)

/**
 * Return a new array sorted by `mode`. `default` keeps the incoming order
 * (manual position), so the list is returned as-is.
 *
 * @param {Array} list - decrypted entities (each with `pinned`, `created_at`)
 * @param {string} mode - one of SORT_OPTIONS ids
 * @param {(entity: object) => string} getName - reads the display name/title
 */
export function sortEntities(list, mode, getName) {
  if (!Array.isArray(list) || mode === 'default') return list
  const compare = mode === 'name' ? byName(getName) : byRecent
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return compare(a, b)
  })
}
