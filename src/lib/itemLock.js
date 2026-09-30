/**
 * itemLock.js - Locked items and spaces. A locked item keeps its title and
 * tags in view, and a locked space its name, but the content needs the vault
 * PIN again. An item in a locked space (or in a sub-space of one) is hidden
 * too, wherever it's listed (Starred, search). The lock is a flag on the row
 * (`locked`); the content is encrypted with the vault key like any other.
 *
 * What has been opened lives only in memory: a reload, or the vault locking,
 * hides it all again.
 */
import { useSyncExternalStore } from 'react'

const revealed = new Set()
// Space id -> { locked, parentId }, recorded whenever the spaces load.
const spaceLocks = new Map()
const listeners = new Set()
let version = 0

function emit() {
  version++
  listeners.forEach(fn => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Whether a locked item or space has been opened with the PIN. */
export function isItemRevealed(id) {
  return revealed.has(id)
}

/** A space's own lock as last loaded (undefined if not seen yet). */
export function isSpaceLocked(id) {
  return spaceLocks.get(id)?.locked
}

// A space and the spaces above it (spaces nest one level; the bound only
// guards against a bad cycle).
function spaceChain(spaceId) {
  const chain = []
  let id = spaceId
  for (let depth = 0; id && depth < 4; depth++) {
    const space = spaceLocks.get(id)
    if (!space) break
    chain.push([id, space])
    id = space.parentId
  }
  return chain
}

/** Whether a space's contents must stay hidden (it or its parent locked). */
export function isSpaceHidden(spaceId) {
  return spaceChain(spaceId).some(([id, s]) => s.locked && !revealed.has(id))
}

/** Whether an item's content must stay hidden (it or its space locked). */
export function isContentHidden(item) {
  if (!item) return false
  return (!!item.locked && !revealed.has(item.id)) || isSpaceHidden(item.space_id)
}

export function revealItem(id) {
  if (revealed.has(id)) return
  revealed.add(id)
  emit()
}

/** Open a space and any locked space above it. */
export function revealSpace(spaceId) {
  let changed = false
  for (const [id, s] of spaceChain(spaceId)) {
    if (s.locked && !revealed.has(id)) { revealed.add(id); changed = true }
  }
  if (changed) emit()
}

/** Open everything hiding an item: its own lock and its spaces'. */
export function revealContent(item) {
  if (item.locked) revealed.add(item.id)
  for (const [id, s] of spaceChain(item.space_id)) if (s.locked) revealed.add(id)
  emit()
}

export function hideItem(id) {
  if (!revealed.delete(id)) return
  emit()
}

/** Hide everything opened (the vault locked, or the user signed out). */
export function hideAllItems() {
  if (revealed.size === 0) return
  revealed.clear()
  emit()
}

/** Record which spaces are locked (called whenever the spaces load). */
export function setSpaceLocks(spaces) {
  let changed = false
  for (const s of spaces || []) {
    const prev = spaceLocks.get(s.id)
    const locked = !!s.locked
    const parentId = s.parent_id ?? null
    if (!prev || prev.locked !== locked || prev.parentId !== parentId) {
      spaceLocks.set(s.id, { locked, parentId })
      changed = true
    }
  }
  if (changed) emit()
}

/** A space was just locked or unlocked here (ahead of the next load). */
export function setSpaceLocked(id, locked) {
  const prev = spaceLocks.get(id)
  spaceLocks.set(id, { locked, parentId: prev?.parentId ?? null })
  if (locked) revealed.delete(id)
  emit()
}

// Re-render on any open / hide / lock change; the reads stay cheap.
function useLockVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

/** Whether this item's content is hidden right now (re-renders on change). */
export function useContentHidden(item) {
  useLockVersion()
  return isContentHidden(item)
}

/** Whether this space is hidden right now (re-renders on change). */
export function useSpaceHidden(spaceId) {
  useLockVersion()
  return isSpaceHidden(spaceId)
}

/** Whether this item or space has been opened (re-renders on change). */
export function useItemRevealed(id) {
  useLockVersion()
  return revealed.has(id)
}
