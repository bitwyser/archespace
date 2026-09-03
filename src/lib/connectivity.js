/**
 * connectivity.js - App-level reachability signal.
 *
 * navigator.onLine only knows whether a network interface is up, not whether
 * the server is actually reachable (a LAN with no internet, or Supabase being
 * down, still reads as "online"). Data fetches report their real outcome here so
 * the offline banner and cache fallback react to actual reachability, not just
 * the interface state.
 */
let reachable = true
const listeners = new Set()

export function isReachable() {
  return reachable
}

export function setReachable(value) {
  if (reachable === value) return
  reachable = value
  for (const fn of listeners) fn(reachable)
}

export function subscribeReachable(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * True when an error looks like a failed network request (as opposed to a real
 * server/permission error), so callers can treat it as "unreachable".
 */
export function isNetworkError(err) {
  if (!navigator.onLine) return true
  if (err instanceof TypeError) return true // fetch() throws TypeError on network failure
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
  return (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('load failed') // Safari's wording
  )
}
