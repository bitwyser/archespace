/**
 * recoveryCode.js - Human-friendly vault recovery codes.
 */

const RECOVERY_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export const RECOVERY_CODE_LENGTH = 12

export function generateRecoveryCode() {
  const n = RECOVERY_CODE_ALPHABET.length
  // Largest multiple of n that fits in a byte (252 for n=36). Reject bytes at
  // or above it so every symbol is equally likely - a plain `byte % n` would
  // bias the first (256 % n) symbols. ~1.6% of draws are rejected.
  const limit = Math.floor(256 / n) * n
  const buf = new Uint8Array(1)
  let code = ''
  while (code.length < RECOVERY_CODE_LENGTH) {
    crypto.getRandomValues(buf)
    if (buf[0] >= limit) continue
    code += RECOVERY_CODE_ALPHABET[buf[0] % n]
  }
  return code
}

export function normalizeRecoveryCode(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function validateRecoveryCode(value) {
  const code = normalizeRecoveryCode(value)
  if (code.length !== RECOVERY_CODE_LENGTH) {
    return `Recovery code must be ${RECOVERY_CODE_LENGTH} lowercase letters or numbers.`
  }
  return null
}
