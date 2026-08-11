/**
 * vaultSession.js - Persist the unlocked vault across page refresh.
 *
 * The master key is held as a NON-EXTRACTABLE CryptoKey in IndexedDB, so a
 * script on the page can use it to decrypt but cannot export the raw bytes.
 * Only a login-time marker and the unlock timestamp live in sessionStorage
 * (non-sensitive, and cleared synchronously so a lock/sign-out invalidates
 * the session immediately even before the async IndexedDB delete finishes).
 *
 * Cleared on manual lock, sign-out, or 24-hour vault auto-lock.
 */
import { autoLockMs } from './vaultAutoLock'

export const VAULT_UNLOCKED_AT_KEY = 'arche:vault-unlocked-at'
const VAULT_SESSION_USER = 'arche:vault-session-user'
const LEGACY_KEY = 'arche:vault-session-key' // old raw-bytes storage; purge it

const DB_NAME = 'arche-vault'
const STORE = 'session'
const KEY_ID = 'master-key'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(value) {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, KEY_ID)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function idbGet() {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY_ID)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function idbDelete() {
  try {
    const db = await openDb()
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(KEY_ID)
        tx.oncomplete = resolve
        tx.onerror = resolve
      })
    } finally {
      db.close()
    }
  } catch {
    // IndexedDB unavailable - nothing to delete.
  }
}

export function clearVaultSession() {
  sessionStorage.removeItem(VAULT_UNLOCKED_AT_KEY)
  sessionStorage.removeItem(VAULT_SESSION_USER)
  sessionStorage.removeItem(LEGACY_KEY)
  idbDelete() // fire-and-forget; the sync markers above already invalidate it
}

export async function saveVaultSession(userId, cryptoKey) {
  try {
    // Re-import as non-extractable so the raw key can't be exported later.
    const raw = await crypto.subtle.exportKey('raw', cryptoKey)
    const nonExtractable = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
    await idbPut(nonExtractable)
    sessionStorage.setItem(VAULT_SESSION_USER, userId)
    sessionStorage.setItem(VAULT_UNLOCKED_AT_KEY, String(Date.now()))
  } catch {
    // Secure storage unavailable: don't cache. Unlock still works this
    // session, it just won't survive a page reload.
    clearVaultSession()
  }
}

/**
 * @param {string} userId
 * @returns {Promise<CryptoKey|null>}
 */
export async function loadVaultSession(userId) {
  if (sessionStorage.getItem(VAULT_SESSION_USER) !== userId) return null

  // Auto-lock is inactivity-based, so VAULT_UNLOCKED_AT_KEY holds the last
  // activity time. Expire the restored session if it's older than the chosen
  // duration ("Never" -> lockMs is null -> never expires on restore).
  const lockMs = autoLockMs()
  const unlockedAt = Number(sessionStorage.getItem(VAULT_UNLOCKED_AT_KEY))
  if (!unlockedAt || (lockMs != null && Date.now() - unlockedAt > lockMs)) {
    clearVaultSession()
    return null
  }

  try {
    const key = await idbGet()
    if (!key) {
      clearVaultSession()
      return null
    }
    return key
  } catch {
    clearVaultSession()
    return null
  }
}
