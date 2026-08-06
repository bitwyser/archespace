/**
 * passkeyVault.js - Supabase persistence + orchestration for passkey unlock.
 *
 * Ties the WebAuthn PRF logic in passkey.js to the user_passkeys table and the
 * existing PIN vault. Enrollment re-verifies the current PIN (like recovery-code
 * setup) so it always wraps a freshly unlocked, exportable master key.
 */
import { supabase } from '../supabase'
import { unlockUserVault } from './vault'
import {
  enrollPasskeyCredential,
  unlockWithPasskeyCredentials,
} from './passkey'

function mapRow(row) {
  return {
    id: row.id,
    credentialId: row.credential_id,
    prfSalt: row.prf_salt,
    wrappedKey: row.wrapped_key,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }
}

/**
 * @param {string} userId
 * @returns {Promise<Array<ReturnType<typeof mapRow>>>}
 */
export async function listPasskeys(userId) {
  const { data, error } = await supabase
    .from('user_passkeys')
    .select('id, credential_id, prf_salt, wrapped_key, label, created_at, last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapRow)
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
  const { error } = await supabase.from('user_passkeys').insert({
    user_id: userId,
    credential_id: credentialId,
    prf_salt: prfSalt,
    wrapped_key: wrappedKey,
    label: label?.trim() || null,
  })
  if (error) throw error
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
  supabase
    .from('user_passkeys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('credential_id', credentialId)
    .then(({ error }) => {
      if (error) console.debug('[passkey] last_used update failed:', error.message)
    })

  return masterKey
}

export async function removePasskey(userId, id) {
  const { error } = await supabase
    .from('user_passkeys')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}
