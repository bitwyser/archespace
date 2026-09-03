/**
 * offlineQueue.js - Persist failed writes while offline; flush on reconnect.
 */
const STORAGE_KEY = 'arche-offline-queue'

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

/** @param {{ type: string, payload: object }} entry */
export function enqueueOffline(entry) {
  const queue = readQueue()
  queue.push({ ...entry, id: crypto.randomUUID(), createdAt: Date.now() })
  writeQueue(queue)
  return queue.length
}

export function getOfflineQueue() {
  return readQueue()
}

/**
 * @param {(entry: object) => Promise<boolean>} processor - return true to remove
 */
export async function flushOfflineQueue(processor) {
  const queue = readQueue()
  if (queue.length === 0) return 0

  const remaining = []
  let flushed = 0

  for (const entry of queue) {
    try {
      const ok = await processor(entry)
      if (ok) flushed++
      else remaining.push(entry)
    } catch {
      remaining.push(entry)
    }
  }

  writeQueue(remaining)
  return flushed
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/** Thrown by assertOnline() so callers can show a consistent offline message. */
export class OfflineError extends Error {
  constructor(message = "You're offline - reconnect to make changes.") {
    super(message)
    this.name = 'OfflineError'
  }
}

/**
 * Guard a write that has no offline queue: throw a friendly OfflineError when
 * offline so the mutation fails fast (and optimistic updates roll back) instead
 * of hanging on a doomed network request.
 */
export function assertOnline() {
  if (!isOnline()) throw new OfflineError()
}
