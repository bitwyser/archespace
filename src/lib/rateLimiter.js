/**
 * rateLimiter.js - Client-side rate limiting (localStorage-persisted).
 *
 * Defense in depth only - not a substitute for server-side limits.
 */
const STORAGE_KEY = 'arche:rate-limits'

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/**
 * @param {string} action - Unique action key (e.g. `login:user@example.com`)
 * @param {number} maxAttempts
 * @param {number} windowMs
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
export function checkClientRateLimit(action, maxAttempts, windowMs) {
  const store = readStore()
  const entry = store[action]
  const now = Date.now()

  if (!entry || now > entry.resetAt) {
    store[action] = { count: 1, resetAt: now + windowMs }
    writeStore(store)
    return { allowed: true, remaining: maxAttempts - 1 }
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count += 1
  writeStore(store)
  return { allowed: true, remaining: maxAttempts - entry.count }
}

/**
 * Record a failed attempt without performing an allowed check first.
 * `windowMs` is how long failures accumulate; `lockoutMs` (defaults to
 * `windowMs`) is how long the block lasts once maxAttempts is reached.
 */
export function recordClientRateLimitFailure(action, maxAttempts, windowMs, lockoutMs = windowMs) {
  const store = readStore()
  const entry = store[action]
  const now = Date.now()

  if (!entry || now > entry.resetAt) {
    store[action] = { count: 1, resetAt: now + windowMs }
  } else {
    entry.count += 1
    if (entry.count >= maxAttempts) {
      entry.resetAt = now + lockoutMs
    }
  }
  writeStore(store)
}

export function clearClientRateLimit(action) {
  const store = readStore()
  delete store[action]
  writeStore(store)
}

export function getClientRateLimitStatus(action, maxAttempts) {
  const store = readStore()
  const entry = store[action]
  const now = Date.now()

  if (!entry || now > entry.resetAt) {
    return { blocked: false, remaining: maxAttempts, retryAfter: 0 }
  }

  if (entry.count >= maxAttempts) {
    return {
      blocked: true,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  return {
    blocked: false,
    remaining: maxAttempts - entry.count,
    retryAfter: 0,
  }
}
