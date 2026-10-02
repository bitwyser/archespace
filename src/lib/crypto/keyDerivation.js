/**
 * keyDerivation.js - Derive an AES key from a vault secret with Argon2id.
 *
 * The stored salt is self-describing ("argon2id$<m>$<t>$<p>$<saltB64>"), so
 * unlock knows the parameters it was made with.
 */
import { argon2idAsync } from '@noble/hashes/argon2.js'
import { bytesFromBase64, bytesToBase64 } from './encoding'

// Argon2id parameters (OWASP-aligned minimum): 19 MiB, 2 passes, 1 lane.
const ARGON2 = { tag: 'argon2id', m: 19456, t: 2, p: 1, dkLen: 32 }

/** A new salt descriptor with a random 16-byte salt. */
export function newSaltDescriptor() {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `${ARGON2.tag}$${ARGON2.m}$${ARGON2.t}$${ARGON2.p}$${bytesToBase64(salt)}`
}

/**
 * Derive the AES-GCM wrapping key from a secret using the KDF described by
 * `descriptor` (the stored `salt` / `recovery_salt` value).
 * @param {string} secret
 * @param {string} descriptor
 * @returns {Promise<CryptoKey>}
 */
export async function deriveVaultKey(secret, descriptor) {
  const [tag, m, t, p, saltB64] = String(descriptor).split('$')
  if (tag !== ARGON2.tag || !saltB64) throw new Error('Unsupported vault key format.')
  const raw = await argon2idAsync(new TextEncoder().encode(secret), bytesFromBase64(saltB64), {
    m: Number(m), t: Number(t), p: Number(p), dkLen: ARGON2.dkLen,
  })
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
