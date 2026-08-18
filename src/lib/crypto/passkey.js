/**
 * passkey.js - WebAuthn PRF-based vault key wrapping (biometric unlock).
 *
 * A platform passkey with the PRF extension yields a stable 32-byte secret that
 * is released only after user verification (Touch ID / Windows Hello / Face ID).
 * That secret never leaves the device; we HKDF it into an AES-GCM wrapping key
 * and use it to wrap the vault master key. This adds a biometric unlock path
 * alongside the PIN without weakening the zero-knowledge model: the server only
 * ever stores ciphertext, the credential id, and a (non-secret) PRF salt.
 *
 * This module is pure WebAuthn + Web Crypto (no Supabase). Persistence and
 * orchestration live in passkeyVault.js.
 */
import { encryptString, decryptString } from './cipher'
import { bytesFromBase64, bytesToBase64 } from './encoding'

const RP_NAME = 'ArcheSpace'
// Domain-separation label for the HKDF that turns the PRF secret into a key.
const PRF_INFO = 'arche-passkey-vault-wrap-v1'

// ── base64url <-> bytes (WebAuthn credential ids) ──────────────
function bytesToB64url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : ''
  return bytesFromBase64(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

async function importRawAesKey(rawBytes) {
  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function exportRawAesKey(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

/**
 * True when this browser + device can do platform (biometric) passkeys.
 * Note: this does NOT prove PRF support - that is only known once a credential
 * is created/asserted, so enrollment surfaces a clear error if PRF is missing.
 * @returns {Promise<boolean>}
 */
export async function isPasskeySupported() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  if (!window.isSecureContext) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function newPrfSalt() {
  const salt = new Uint8Array(32)
  crypto.getRandomValues(salt)
  return salt
}

/** HKDF the raw PRF secret into a non-extractable AES-GCM wrapping key. */
async function wrapKeyFromPrf(prfBytes) {
  const hkdfKey = await crypto.subtle.importKey('raw', prfBytes, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(PRF_INFO),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function extractPrfFirst(credential) {
  const results = credential?.getClientExtensionResults?.()
  const first = results?.prf?.results?.first
  return first ? new Uint8Array(first) : null
}

/**
 * Turn a WebAuthn create()/get() failure into a friendly, product-level
 * message. A cancelled or timed-out prompt surfaces as NotAllowedError with a
 * spec URL; per WebAuthn privacy guidance the wording stays deliberately vague
 * (it must not reveal whether a credential exists).
 */
function webAuthnErrorMessage(err, fallback) {
  switch (err?.name) {
    case 'NotAllowedError':
      return 'Biometric unlock was cancelled or timed out. Try again, or use your PIN.'
    case 'InvalidStateError':
      return 'A passkey is already set up on this device. Try unlocking, or use your PIN.'
    case 'SecurityError':
      return 'Biometric unlock is not available on this page. Use your PIN.'
    case 'NotSupportedError':
      return 'This device does not support biometric unlock. Use your PIN.'
    default:
      return fallback
  }
}

/**
 * Register a new platform passkey and wrap `masterKey` with its PRF secret.
 * @param {{ userId: string, userName: string, masterKey: CryptoKey }} params
 * @returns {Promise<{ credentialId: string, prfSalt: string, wrappedKey: string }>}
 */
export async function enrollPasskeyCredential({ userId, userName, masterKey }) {
  const prfSalt = newPrfSalt()
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const name = userName || 'Arche vault'

  let credential
  try {
    credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME }, // rp.id defaults to the current domain (works on localhost + prod)
      user: {
        id: new TextEncoder().encode(userId),
        name,
        displayName: name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
    })
  } catch (err) {
    throw new Error(webAuthnErrorMessage(err, "Couldn't set up biometric unlock. Try again, or use your PIN."), { cause: err })
  }
  if (!credential) throw new Error('Biometric setup was cancelled. Use your PIN.')

  const credentialId = bytesToB64url(new Uint8Array(credential.rawId))

  // Some browsers return the PRF output at creation time; others only expose
  // `prf.enabled` and require a follow-up assertion to actually evaluate it.
  let prf = extractPrfFirst(credential)
  if (!prf) {
    const ext = credential.getClientExtensionResults?.()
    if (ext?.prf?.enabled === false || ext?.prf === undefined) {
      throw new Error('This device does not support passkey PRF, which biometric vault unlock requires.')
    }
    prf = await evaluatePrf(credentialId, prfSalt)
  }
  if (!prf) throw new Error('Could not derive a key from this passkey (PRF unavailable).')

  const wrapKey = await wrapKeyFromPrf(prf)
  const raw = await exportRawAesKey(masterKey)
  const wrappedKey = await encryptString(bytesToBase64(raw), wrapKey)
  return { credentialId, prfSalt: bytesToBase64(prfSalt), wrappedKey }
}

/** Assert a single credential to read its PRF output (fallback after create). */
async function evaluatePrf(credentialId, prfSalt) {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  let assertion
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: b64urlToBytes(credentialId) }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    })
  } catch (err) {
    throw new Error(webAuthnErrorMessage(err, "Couldn't set up biometric unlock. Try again, or use your PIN."), { cause: err })
  }
  return extractPrfFirst(assertion)
}

/**
 * Prompt for biometric verification, evaluate PRF for whichever enrolled
 * credential the user picks, and unwrap the master key.
 * @param {Array<{ credentialId: string, prfSalt: string, wrappedKey: string }>} rows
 * @returns {Promise<{ masterKey: CryptoKey, credentialId: string }>}
 */
export async function unlockWithPasskeyCredentials(rows) {
  if (!rows?.length) throw new Error('No passkeys are enrolled for this vault.')

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const byId = new Map(rows.map(r => [r.credentialId, r]))

  // Each credential can have its own PRF salt, so map salts per credential id.
  const evalByCredential = {}
  for (const r of rows) {
    evalByCredential[r.credentialId] = { first: bytesFromBase64(r.prfSalt) }
  }

  let assertion
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: rows.map(r => ({ type: 'public-key', id: b64urlToBytes(r.credentialId) })),
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { evalByCredential } },
      },
    })
  } catch (err) {
    throw new Error(webAuthnErrorMessage(err, 'Could not unlock with biometrics. Use your PIN instead.'), { cause: err })
  }
  if (!assertion) throw new Error('Biometric unlock was cancelled. Use your PIN instead.')

  const usedId = bytesToB64url(new Uint8Array(assertion.rawId))
  const row = byId.get(usedId)
  if (!row) throw new Error('That passkey is not enrolled for this vault.')

  const prf = extractPrfFirst(assertion)
  if (!prf) throw new Error('This passkey did not return a PRF secret. Unlock with your PIN instead.')

  const wrapKey = await wrapKeyFromPrf(prf)
  let rawB64
  try {
    rawB64 = await decryptString(row.wrappedKey, wrapKey)
  } catch {
    throw new Error('Could not unlock the vault with this passkey.')
  }
  const masterKey = await importRawAesKey(bytesFromBase64(rawB64))
  return { masterKey, credentialId: usedId }
}
