/**
 * totp.js - RFC 6238 TOTP code generation and otpauth:// parsing.
 *
 * Codes are computed in the browser with Web Crypto (HMAC). The TOTP secrets
 * live inside an encrypted item's content, so they are stored zero-knowledge
 * exactly like any other vault data - the server never sees them.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const HASH_ALGORITHMS = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' }

/** Decode a Base32 (RFC 4648) secret to bytes, ignoring spaces/padding/case. */
function base32Decode(input) {
  const clean = (input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue // skip stray separators
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

/** True when a string decodes to a usable Base32 secret. */
export function isValidTotpSecret(secret) {
  return base32Decode(secret).length > 0
}

/** Normalise an algorithm label to a Web Crypto hash name. */
function hashName(algorithm) {
  return HASH_ALGORITHMS[(algorithm || 'SHA1').toUpperCase()] || 'SHA-1'
}

/**
 * Generate a TOTP code. Returns the zero-padded string, or null if the secret
 * is empty/invalid.
 * @param {string} secretBase32
 * @param {{ digits?: number, period?: number, algorithm?: string, timestamp?: number }} [opts]
 */
export async function generateTotp(
  secretBase32,
  { digits = 6, period = 30, algorithm = 'SHA1', timestamp = Date.now() } = {}
) {
  const keyBytes = base32Decode(secretBase32)
  if (keyBytes.length === 0) return null

  const counter = Math.floor(timestamp / 1000 / period)
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: hashName(algorithm) },
    false,
    ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer))
  const offset = sig[sig.length - 1] & 0x0f
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    (sig[offset + 1] << 16) |
    (sig[offset + 2] << 8) |
    sig[offset + 3]
  return (binary % 10 ** digits).toString().padStart(digits, '0')
}

/** Seconds left in the current TOTP window. */
export function secondsRemaining(period = 30, timestamp = Date.now()) {
  return period - (Math.floor(timestamp / 1000) % period)
}

/**
 * Parse an otpauth://totp/... URI (from a QR code) into an entry, or null.
 */
export function parseOtpauthUri(uri) {
  try {
    const url = new URL((uri || '').trim())
    if (url.protocol !== 'otpauth:') return null
    if (url.host.toLowerCase() !== 'totp') return null // HOTP not supported

    const secret = (url.searchParams.get('secret') || '').replace(/\s+/g, '')
    if (!secret || !isValidTotpSecret(secret)) return null

    const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
    let issuer = url.searchParams.get('issuer') || ''
    let account = label
    if (label.includes(':')) {
      const [labelIssuer, labelAccount] = label.split(':')
      if (!issuer) issuer = labelIssuer.trim()
      account = labelAccount.trim()
    }

    return {
      issuer: issuer.trim(),
      label: account.trim(),
      secret,
      digits: parseInt(url.searchParams.get('digits'), 10) || 6,
      period: parseInt(url.searchParams.get('period'), 10) || 30,
      algorithm: (url.searchParams.get('algorithm') || 'SHA1').toUpperCase(),
    }
  } catch {
    return null
  }
}
