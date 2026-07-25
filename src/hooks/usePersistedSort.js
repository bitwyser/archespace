import { useState, useCallback } from 'react'
import { DEFAULT_SORT } from '../lib/sortEntities'

/**
 * Sort-mode state that survives reloads by persisting to localStorage.
 * Falls back to the default order if storage is unavailable or empty.
 *
 * @param {string} storageKey - localStorage key (e.g. 'arche-sort-spaces')
 * @returns {[string, (value: string) => void]}
 */
export function usePersistedSort(storageKey) {
  const [sort, setSortState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || DEFAULT_SORT
    } catch {
      return DEFAULT_SORT
    }
  })

  const setSort = useCallback((value) => {
    setSortState(value)
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      // Private mode or storage full - keep the in-memory value only.
    }
  }, [storageKey])

  return [sort, setSort]
}
