/**
 * vault.js - Per-user vault setup / unlock (Supabase user_encryption row).
 *
 * New vaults use a random master key wrapped with a PIN-derived key.
 * A separate one-time recovery code can also wrap the same master key.
 */
import { supabase } from '../supabase'
import { encryptString, decryptString } from './cipher'
import {
  deriveVaultKey,
  newSaltDescriptor,
} from './keyDerivation'
import { validateVaultPin } from './vaultPin'
import { bytesFromBase64, bytesToBase64 } from './encoding'
import {
  generateRecoveryCode,
  normalizeRecoveryCode,
  validateRecoveryCode,
} from './recoveryCode'

const VAULT_CHECK_PLAINTEXT = 'ARCHE_VAULT_V1_OK'
export const VAULT_FORMAT_PIN_WRAPPED = 'pin_wrapped'
const RECOVERY_COLUMNS_MISSING_MESSAGE =
  'Vault recovery is not enabled in the database yet. Run the recovery_salt and recovery_wrapped_key migration, then reload the Supabase schema cache.'

function assertValidPin(pin) {
  const err = validateVaultPin(pin)
  if (err) throw new Error(err)
}

export async function importRawAesKey(rawBytes) {
  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function exportRawAesKey(key) {
  const buf = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(buf)
}

async function generateMasterKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * @param {string} userId
 * @returns {Promise<{ hasVault: boolean }>}
 */
export async function getVaultStatus(userId) {
  const { data, error } = await supabase
    .from('user_encryption')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return { hasVault: !!data }
}

/**
 * @param {string} userId
 */
async function fetchVaultMeta(userId) {
  const { data, error } = await supabase
    .from('user_encryption')
    .select('user_id, salt, key_check, wrapped_key, vault_format, pin_locked_until, recovery_salt, recovery_wrapped_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isOptionalVaultColumnError(error)) return fetchVaultMetaWithoutOptionalColumns(userId)
    throw error
  }
  return data
}

async function fetchVaultMetaWithoutOptionalColumns(userId) {
  const { data, error } = await supabase
    .from('user_encryption')
    .select('user_id, salt, key_check, wrapped_key, vault_format')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return data
  return {
    ...data,
    pin_locked_until: null,
    recovery_salt: null,
    recovery_wrapped_key: null,
    optionalColumnsMissing: true,
    recoveryColumnsMissing: true,
  }
}

function isOptionalVaultColumnError(error) {
  const message = error?.message || ''
  return (
    message.includes('schema cache') &&
    (message.includes('pin_locked_until') ||
      message.includes('recovery_salt') ||
      message.includes('recovery_wrapped_key'))
  )
}

function isRecoverySchemaCacheError(error) {
  const message = error?.message || ''
  return (
    message.includes('schema cache') &&
    (message.includes('recovery_salt') || message.includes('recovery_wrapped_key'))
  )
}

async function assertVaultUnlockAllowed(userId) {
  const { data, error } = await supabase.rpc('get_vault_pin_lock_status')
  if (error) {
    // Fallback for projects that have not run the migration yet.
    try {
      const meta = await fetchVaultMeta(userId)
      if (meta?.pin_locked_until && new Date(meta.pin_locked_until) > new Date()) {
        const retryAfter = Math.ceil((new Date(meta.pin_locked_until) - Date.now()) / 1000)
        throw new Error(formatPinLockoutMessage(retryAfter))
      }
    } catch (fallbackError) {
      if (fallbackError?.message?.startsWith('Too many failed PIN attempts.')) {
        throw fallbackError
      }
    }
    return
  }
  if (data?.locked) {
    throw new Error(formatPinLockoutMessage(data.retry_after_seconds || 300))
  }
}

function formatPinLockoutMessage(retryAfterSeconds) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `Too many failed PIN attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

async function recordVaultUnlockFailure() {
  const { error } = await supabase.rpc('record_vault_pin_unlock_failure')
  if (error) console.warn('Failed to record vault PIN failure:', error.message)
}

async function recordVaultUnlockSuccess() {
  const { error } = await supabase.rpc('record_vault_pin_unlock_success')
  if (error) console.warn('Failed to reset vault PIN attempts:', error.message)
}

function isIncorrectPinError(err) {
  const msg = err?.message || ''
  return msg.includes('Incorrect PIN') || msg.includes('cannot unlock')
}


/**
 * Create a new PIN-protected vault for a new user.
 * @param {string} userId
 * @param {string} pin
 */
export async function setupUserVault(userId, pin) {
  assertValidPin(pin)
  // Safety net: never overwrite an existing vault. If a row already exists this
  // is an unlock situation misread as first-run setup - replacing the master key
  // would lock the user out of all their data. Fail closed (a read error also
  // aborts, rather than risk an overwrite).
  const existing = await fetchVaultMeta(userId)
  if (existing && (existing.wrapped_key || existing.key_check)) {
    throw new Error('A vault already exists for this account. Reload and unlock with your PIN.')
  }
  const masterKey = await generateMasterKey()
  const recoveryCode = generateRecoveryCode()
  const { recoverySaved } = await persistPinWrappedVault(userId, pin, masterKey, { recoveryCode })
  return {
    masterKey,
    recoveryCode: recoverySaved ? recoveryCode : null,
    recoveryUnavailable: !recoverySaved,
  }
}

/**
 * Unlock with vault PIN.
 * @param {string} userId
 * @param {string} pin
 */
export async function unlockUserVault(userId, pin) {
  assertValidPin(pin)
  await assertVaultUnlockAllowed(userId)
  const meta = await fetchVaultMeta(userId)
  if (!meta) {
    throw new Error('No vault PIN configured. Create a PIN to continue.')
  }
  try {
    const key = await unlockPinWrappedVault(meta, pin)
    await recordVaultUnlockSuccess()
    return key
  } catch (err) {
    if (isIncorrectPinError(err)) {
      await recordVaultUnlockFailure()
    }
    throw err
  }
}


/**
 * Change vault PIN (verifies current PIN first).
 */
export async function changeVaultPinWithVerification(userId, currentPin, newPin) {
  assertValidPin(newPin)
  await assertVaultUnlockAllowed(userId)
  try {
    const meta = await fetchVaultMeta(userId)
    if (!meta) throw new Error('No vault PIN configured.')
    const masterKey = await unlockPinWrappedVault(meta, currentPin)
    await recordVaultUnlockSuccess()
    await persistPinWrappedVault(userId, newPin, masterKey)
    return masterKey
  } catch (err) {
    if (isIncorrectPinError(err)) {
      await recordVaultUnlockFailure()
    }
    throw err
  }
}

/**
 * Add or replace the one-time recovery code after verifying the current PIN.
 */
export async function createVaultRecoveryCode(userId, currentPin) {
  assertValidPin(currentPin)
  await assertVaultUnlockAllowed(userId)
  try {
    const meta = await fetchVaultMeta(userId)
    if (!meta) throw new Error('No vault PIN configured.')
    if (meta.recoveryColumnsMissing) {
      throw new Error(RECOVERY_COLUMNS_MISSING_MESSAGE)
    }

    const masterKey = await unlockPinWrappedVault(meta, currentPin)
    const recoveryCode = generateRecoveryCode()
    await persistRecoveryWrappedVault(userId, masterKey, recoveryCode)
    await recordVaultUnlockSuccess()
    return { masterKey, recoveryCode }
  } catch (err) {
    if (isIncorrectPinError(err)) {
      await recordVaultUnlockFailure()
    }
    throw err
  }
}

/**
 * Recover the master key with the one-time recovery code, then set a new PIN.
 */
export async function recoverVaultWithRecoveryCode(userId, recoveryCode, newPin) {
  assertValidPin(newPin)
  const codeErr = validateRecoveryCode(recoveryCode)
  if (codeErr) throw new Error(codeErr)

  const meta = await fetchVaultMeta(userId)
  if (!meta) throw new Error('No vault PIN configured.')
  if (meta.recoveryColumnsMissing) {
    throw new Error(RECOVERY_COLUMNS_MISSING_MESSAGE)
  }
  if (!meta.recovery_salt || !meta.recovery_wrapped_key) {
    throw new Error('No recovery code is configured for this vault.')
  }

  try {
    const masterKey = await unlockRecoveryWrappedVault(meta, recoveryCode)
    const nextRecoveryCode = generateRecoveryCode()
    const { recoverySaved } = await persistPinWrappedVault(userId, newPin, masterKey, { recoveryCode: nextRecoveryCode })
    if (!recoverySaved) {
      throw new Error(RECOVERY_COLUMNS_MISSING_MESSAGE)
    }
    await recordVaultUnlockSuccess()
    return { masterKey, recoveryCode: nextRecoveryCode }
  } catch (err) {
    throw new Error(
      err?.message || 'Recovery code could not unlock your vault.',
      { cause: err }
    )
  }
}

/**
 * Verify the recovery code against the current master key, then set a new PIN.
 */
export async function changeVaultPinWithRecoveryCode(userId, recoveryCode, newPin) {
  return recoverVaultWithRecoveryCode(userId, recoveryCode, newPin)
}

async function persistPinWrappedVault(userId, pin, masterKey, { recoveryCode = '' } = {}) {
  const pinSalt = newSaltDescriptor()
  const pinKey = await deriveVaultKey(pin, pinSalt)
  const raw = await exportRawAesKey(masterKey)
  const wrappedKey = await encryptString(bytesToBase64(raw), pinKey)
  const keyCheck = await encryptString(VAULT_CHECK_PLAINTEXT, masterKey)

  const payload = {
    user_id: userId,
    salt: pinSalt,
    key_check: keyCheck,
    wrapped_key: wrappedKey,
    vault_format: VAULT_FORMAT_PIN_WRAPPED,
  }

  if (recoveryCode) {
    const normalizedCode = normalizeRecoveryCode(recoveryCode)
    const recoverySalt = newSaltDescriptor()
    const recoveryKey = await deriveVaultKey(normalizedCode, recoverySalt)
    payload.recovery_salt = recoverySalt
    payload.recovery_wrapped_key = await encryptString(bytesToBase64(raw), recoveryKey)
  }

  const { error } = await supabase.from('user_encryption').upsert(payload)
  if (error) {
    if (recoveryCode && isRecoverySchemaCacheError(error)) {
      const pinOnlyPayload = { ...payload }
      delete pinOnlyPayload.recovery_salt
      delete pinOnlyPayload.recovery_wrapped_key

      const { error: pinOnlyError } = await supabase.from('user_encryption').upsert(pinOnlyPayload)
      if (pinOnlyError) throw pinOnlyError
      return { recoverySaved: false }
    }
    throw error
  }
  return { recoverySaved: true }
}

async function persistRecoveryWrappedVault(userId, masterKey, recoveryCode) {
  const raw = await exportRawAesKey(masterKey)
  const normalizedCode = normalizeRecoveryCode(recoveryCode)
  const recoverySalt = newSaltDescriptor()
  const recoveryKey = await deriveVaultKey(normalizedCode, recoverySalt)
  const payload = {
    recovery_salt: recoverySalt,
    recovery_wrapped_key: await encryptString(bytesToBase64(raw), recoveryKey),
  }

  const { error } = await supabase
    .from('user_encryption')
    .update(payload)
    .eq('user_id', userId)
  if (error) {
    if (isRecoverySchemaCacheError(error)) {
      throw new Error(RECOVERY_COLUMNS_MISSING_MESSAGE, { cause: error })
    }
    throw error
  }
}

async function unlockRecoveryWrappedVault(meta, recoveryCode) {
  const recoveryKey = await deriveVaultKey(normalizeRecoveryCode(recoveryCode), meta.recovery_salt)
  const rawB64 = await decryptString(meta.recovery_wrapped_key, recoveryKey)
  const masterKey = await importRawAesKey(bytesFromBase64(rawB64))
  const check = await decryptString(meta.key_check, masterKey)
  if (check !== VAULT_CHECK_PLAINTEXT) {
    throw new Error('Recovery code could not unlock your vault.')
  }
  return masterKey
}

async function unlockPinWrappedVault(meta, pin) {
  const pinKey = await deriveVaultKey(pin, meta.salt)
  let rawB64
  try {
    rawB64 = await decryptString(meta.wrapped_key, pinKey)
  } catch {
    // A wrong PIN makes AES-GCM decryption throw (OperationError) rather than
    // reaching the key_check below. Normalise it to the incorrect-PIN error so
    // callers (server RPC + client rate limiter) record the failed attempt.
    throw new Error('Incorrect PIN - cannot unlock your encrypted vault.')
  }
  const masterKey = await importRawAesKey(bytesFromBase64(rawB64))
  const check = await decryptString(meta.key_check, masterKey)
  if (check !== VAULT_CHECK_PLAINTEXT) {
    throw new Error('Incorrect PIN - cannot unlock your encrypted vault.')
  }
  return masterKey
}

