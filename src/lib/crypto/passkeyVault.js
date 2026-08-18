/**
 * passkeyVault.js - Local persistence + orchestration for passkey unlock.
 *
 * Ties the WebAuthn PRF logic in passkey.js to a local IndexedDB store
 * (passkeyStore.js) and the existing PIN vault. Nothing is sent to the server:
 * the wrapped master key, credential id, and PRF salt stay in the browser, and
 * are useless without the enrolled device's passkey. Enrollment re-verifies the
 * current PIN (like recovery-code setup) so it always wraps a freshly unlocked,
 * exportable master key.
 */
import { unlockUserVault } from './vault'
import {
  enrollPasskeyCredential,
  unlockWithPasskeyCredentials,
} from './passkey'
import {
  listPasskeyRecords,
  savePasskeyRecord,
  deletePasskeyRecord,
  updatePasskeyRecord,
} from './passkeyStore'

/**
 * @param {string} userId
 * @returns {Promise<Array<{id, credentialId, prfSalt, wrappedKey, label, createdAt, lastUsedAt}>>}
 */
export async function listPasskeys(userId) {
  const rows = await listPasskeyRecords(userId)
  return rows.map(r => ({
    id: r.id,
    credentialId: r.credentialId,
    prfSalt: r.prfSalt,
    wrappedKey: r.wrappedKey,
    label: r.label,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
  }))
}

/**
 * Register a passkey against the current vault. Verifies `pin` first (which also
 * runs the existing unlock rate-limiter) to obtain an exportable master key.
 * @returns {Promise<CryptoKey>} the unlocked master key
 */
export async function enrollPasskey(userId, pin, userName, label) {
  const masterKey = await unlockUserVault(userId, pin)
  const { credentialId, prfSalt, wrappedKey } = await enrollPasskeyCredential({
    userId,
    userName,
    masterKey,
  })
  // One passkey per browser: replace any existing local record for this user.
  const existing = await listPasskeyRecords(userId)
  await Promise.all(existing.map(r => deletePasskeyRecord(r.id)))
  await savePasskeyRecord({
    id: crypto.randomUUID(),
    userId,
    credentialId,
    prfSalt,
    wrappedKey,
    label: label?.trim() || null,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  })
  return masterKey
}

/**
 * Unlock the vault with an enrolled passkey (biometric prompt).
 * @returns {Promise<CryptoKey>} the unlocked master key
 */
export async function unlockVaultWithPasskey(userId) {
  const rows = await listPasskeys(userId)
  if (!rows.length) throw new Error('No passkeys are enrolled for this vault.')

  const { masterKey, credentialId } = await unlockWithPasskeyCredentials(rows)

  // Best-effort "last used" bookkeeping; never block unlock on it.
  const used = rows.find(r => r.credentialId === credentialId)
  if (used) {
    updatePasskeyRecord(used.id, { lastUsedAt: new Date().toISOString() })
      .catch(err => console.debug('[passkey] last_used update failed:', err?.message))
  }

  return masterKey
}

// userId kept for a stable signature; local records are removed by id alone.
export async function removePasskey(userId, id) {
  await deletePasskeyRecord(id)
}
