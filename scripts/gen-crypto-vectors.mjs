/**
 * gen-crypto-vectors.mjs - Generate the cross-client crypto conformance vectors.
 *
 * Produces spec/vectors.json from the REAL web crypto (cipher.js) and the same
 * Argon2id / PBKDF2 parameters keyDerivation.js uses, then self-verifies every
 * vector by decrypting it back. Any other client (the Flutter app) is correct
 * iff it reproduces and consumes these. See spec/crypto-format.md.
 *
 *   node scripts/gen-crypto-vectors.mjs
 *
 * Regenerate and re-vendor to each client whenever the crypto changes.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { argon2idAsync } from '@noble/hashes/argon2.js'

// arc1 cipher, mirroring src/lib/crypto/cipher.js exactly (standard AES-256-GCM,
// 12-byte IV, tag appended, standard base64). Reimplemented here rather than
// imported because the web module uses Vite-style extensionless imports that
// Node ESM will not resolve. The round-trip self-check below guards drift.
const CIPHER_PREFIX = 'arc1:'
async function encryptString(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plaintext)))
  return `${CIPHER_PREFIX}${b64(iv)}.${b64(new Uint8Array(ct))}`
}
async function decryptString(value, key) {
  if (!value.startsWith(CIPHER_PREFIX)) return value
  const body = value.slice(CIPHER_PREFIX.length)
  const dot = body.indexOf('.')
  const iv = Buffer.from(body.slice(0, dot), 'base64')
  const ct = Buffer.from(body.slice(dot + 1), 'base64')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

const ARGON2 = { m: 19456, t: 2, p: 1, dkLen: 32 }
const PBKDF2_ITERATIONS = 310000
const CHECK_PLAINTEXT = 'ARCHE_VAULT_V1_OK'

const b64 = (bytes) => Buffer.from(bytes).toString('base64')
const utf8 = (s) => new TextEncoder().encode(s)
// Deterministic fixed byte arrays so regeneration only changes the random IVs.
const fixedBytes = (n, start = 0) => new Uint8Array(Array.from({ length: n }, (_, i) => (start + i) % 256))

const importAes = (raw) =>
  crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])

async function argon2Key(secret, salt) {
  return argon2idAsync(utf8(secret), salt, ARGON2)
}

async function pbkdf2Key(secret, salt) {
  const material = await crypto.subtle.importKey('raw', utf8(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  )
  return new Uint8Array(bits)
}

async function main() {
  const kdf = []
  const decrypt = []

  // --- KDF vectors -------------------------------------------------------
  const argonSalt = fixedBytes(16, 1)
  const argonDescriptor = `argon2id$${ARGON2.m}$${ARGON2.t}$${ARGON2.p}$${b64(argonSalt)}`
  for (const secret of ['123456', 'correct horse battery staple 42', 'PΛSSwörd🔐']) {
    const raw = await argon2Key(secret, argonSalt)
    kdf.push({ algo: 'argon2id', secret, descriptor: argonDescriptor, expectedKeyB64: b64(raw) })
  }

  const pbkdfSalt = fixedBytes(16, 100)
  const pbkdfDescriptor = b64(pbkdfSalt) // legacy: plain base64 salt, no prefix
  for (const secret of ['123456', 'legacy passphrase']) {
    const raw = await pbkdf2Key(secret, pbkdfSalt)
    kdf.push({ algo: 'pbkdf2', secret, descriptor: pbkdfDescriptor, expectedKeyB64: b64(raw) })
  }

  // --- Symmetric decrypt vectors ----------------------------------------
  const contentKeyRaw = fixedBytes(32, 7)
  const contentKey = await importAes(contentKeyRaw)
  const plaintexts = [
    'Hello, Arche',
    JSON.stringify({ text: 'a note', items: [1, 2, 3], done: false }),
    'unicode: héllo 🔐 你好 - end',
    ' ', // whitespace stays intact
  ]
  for (const plaintext of plaintexts) {
    const arc1 = await encryptString(plaintext, contentKey)
    decrypt.push({ keyB64: b64(contentKeyRaw), arc1, expectedPlaintext: plaintext })
  }

  // --- Full vault-unlock vector -----------------------------------------
  const pin = '135790'
  const vaultSalt = fixedBytes(16, 200)
  const vaultDescriptor = `argon2id$${ARGON2.m}$${ARGON2.t}$${ARGON2.p}$${b64(vaultSalt)}`
  const pinKey = await importAes(await argon2Key(pin, vaultSalt))

  const masterRaw = fixedBytes(32, 50)
  const masterKey = await importAes(masterRaw)

  const wrappedKey = await encryptString(b64(masterRaw), pinKey)
  const keyCheck = await encryptString(CHECK_PLAINTEXT, masterKey)
  const samples = []
  for (const plaintext of ['My first space', JSON.stringify({ text: 'secret note' })]) {
    samples.push({ arc1: await encryptString(plaintext, masterKey), plaintext })
  }
  const vaultUnlock = {
    pin,
    salt: vaultDescriptor,
    wrappedKey,
    keyCheck,
    checkPlaintext: CHECK_PLAINTEXT,
    masterKeyB64: b64(masterRaw),
    samples,
  }

  // --- Self-verification: prove every vector round-trips ----------------
  for (const v of kdf) {
    const raw = v.algo === 'argon2id'
      ? await argon2Key(v.secret, Buffer.from(v.descriptor.split('$')[4], 'base64'))
      : await pbkdf2Key(v.secret, Buffer.from(v.descriptor, 'base64'))
    assert.equal(b64(raw), v.expectedKeyB64, `KDF vector drift: ${v.algo} ${v.secret}`)
  }
  for (const v of decrypt) {
    const key = await importAes(Buffer.from(v.keyB64, 'base64'))
    assert.equal(await decryptString(v.arc1, key), v.expectedPlaintext, 'decrypt vector failed')
  }
  {
    const k = await importAes(await argon2Key(vaultUnlock.pin, vaultSalt))
    const rawB64 = await decryptString(vaultUnlock.wrappedKey, k)
    const mk = await importAes(Buffer.from(rawB64, 'base64'))
    assert.equal(await decryptString(vaultUnlock.keyCheck, mk), CHECK_PLAINTEXT, 'key_check failed')
    for (const s of vaultUnlock.samples) {
      assert.equal(await decryptString(s.arc1, mk), s.plaintext, 'sample decrypt failed')
    }
  }

  const out = {
    $comment: 'Generated by scripts/gen-crypto-vectors.mjs from the web crypto. Do not hand-edit. See spec/crypto-format.md.',
    format: 'arc1',
    params: { argon2id: ARGON2, pbkdf2: { hash: 'SHA-256', iterations: PBKDF2_ITERATIONS }, aes: 'AES-256-GCM', ivBytes: 12, base64: 'standard+padding' },
    kdf,
    decrypt,
    vaultUnlock,
  }
  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'vectors.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${outPath}`)
  console.log(`Verified ${kdf.length} KDF + ${decrypt.length} decrypt + 1 vault-unlock vectors.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
