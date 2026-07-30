/**
 * vectors.test.js - Anchor spec/vectors.json to the real crypto.
 *
 * The Flutter client is validated against spec/vectors.json. This test proves
 * those vectors still match THIS repo's actual cipher + key derivation, so the
 * cross-client contract can't silently drift. Regenerate the file with
 * `node scripts/gen-crypto-vectors.mjs` if this fails after an intended change.
 */
import { describe, it, expect } from 'vitest'
import vectors from '../../../spec/vectors.json'
import { encryptString, decryptString } from './cipher'
import { deriveVaultKey } from './keyDerivation'

function importAes(keyB64) {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

describe('crypto conformance vectors', () => {
  it('decrypts every symmetric vector with the real cipher', async () => {
    for (const v of vectors.decrypt) {
      const key = await importAes(v.keyB64)
      expect(await decryptString(v.arc1, key)).toBe(v.expectedPlaintext)
    }
  })

  it('derives the expected key for every KDF vector', async () => {
    // deriveVaultKey returns a non-extractable key, so prove equality by
    // encrypting with the expected key and decrypting with the derived one.
    for (const v of vectors.kdf) {
      const expected = await importAes(v.expectedKeyB64)
      const probe = await encryptString(`probe:${v.secret}`, expected)
      const derived = await deriveVaultKey(v.secret, v.descriptor)
      expect(await decryptString(probe, derived)).toBe(`probe:${v.secret}`)
    }
  })

  it('runs the full vault-unlock flow', async () => {
    const vu = vectors.vaultUnlock
    const pinKey = await deriveVaultKey(vu.pin, vu.salt)
    const rawB64 = await decryptString(vu.wrappedKey, pinKey)
    const masterKey = await importAes(rawB64)
    expect(await decryptString(vu.keyCheck, masterKey)).toBe(vu.checkPlaintext)
    for (const s of vu.samples) {
      expect(await decryptString(s.arc1, masterKey)).toBe(s.plaintext)
    }
  })
})
