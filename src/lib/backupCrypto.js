/**
 * backupCrypto.js - Encrypted backup files.
 *
 * The backup's contents (spaces and items) are encrypted with the vault key,
 * and the file carries that key wrapped with the vault PIN, as the server
 * stores it. So the file opens with no prompt in the same vault, and anywhere
 * else (a new account, a reset vault, the other app) with the vault PIN the
 * user had when exporting. Readable (older) backups still import.
 *
 *   { app, version: 3, encrypted: true, exportedAt,
 *     vault: { salt, wrapped_key, key_check },  // PIN-wrapped vault key
 *     data: 'arc1:...' }                         // { spaces, items }, encrypted
 */
import { decryptJson, encryptJson } from './crypto/cipher'
import { unwrapVaultKey } from './crypto/vault'

export const ENCRYPTED_BACKUP_VERSION = 3

/** Whether a parsed backup file is an encrypted one. */
export function isEncryptedBackup(parsed) {
  return !!parsed && parsed.encrypted === true && typeof parsed.data === 'string' && !!parsed.vault
}

/** Wrap a backup's contents into an encrypted backup file object. */
export async function sealBackup(contents, cryptoKey, vaultMeta) {
  return {
    app: 'ArcheSpace',
    version: ENCRYPTED_BACKUP_VERSION,
    encrypted: true,
    exportedAt: new Date().toISOString(),
    vault: {
      salt: vaultMeta.salt,
      wrapped_key: vaultMeta.wrapped_key,
      key_check: vaultMeta.key_check,
    },
    data: await encryptJson(contents, cryptoKey),
  }
}

/** Open with a vault key already in hand; null if it's another vault's file. */
export async function openBackupWithKey(sealed, cryptoKey) {
  try {
    return await decryptJson(sealed.data, cryptoKey)
  } catch {
    return null
  }
}

/**
 * Open with the vault PIN the backup was made with. Throws 'Incorrect PIN...'
 * when it doesn't open the file's vault key.
 */
export async function openBackupWithPin(sealed, pin) {
  const key = await unwrapVaultKey(sealed.vault, pin)
  return decryptJson(sealed.data, key)
}
