/**
 * mfa.js - Two-factor auth (TOTP) via Supabase MFA, plus recoverable backup
 * codes.
 *
 * The TOTP secret lives only in Supabase's auth.mfa_factors (never in a
 * client-readable table), so 2FA still protects the account if the login
 * password is compromised. Backup codes are 12-char codes (same format as the
 * vault recovery code); only their SHA-256 hash is stored, and redeeming one
 * runs a SECURITY DEFINER function that removes the lost factor - see schema.sql
 * section 4b.
 */
import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { generateRecoveryCode, normalizeRecoveryCode } from './crypto/recoveryCode'

// One code is enough: redeeming it disables 2FA, so extra codes would be dead
// the moment the first is used.
export const BACKUP_CODE_COUNT = 1

/**
 * Check the account password without disturbing the active session. Signing in
 * on the shared client would drop a 2FA user below AAL2 (which unenroll needs),
 * so this uses a throwaway, non-persistent client that never stores a session.
 */
export async function verifyAccountPassword(email, password) {
  const probe = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
  const { error } = await probe.auth.signInWithPassword({ email, password })
  try { await probe.auth.signOut({ scope: 'local' }) } catch { /* ignore */ }
  return !error
}

/** Hex SHA-256, matching the SQL `encode(digest(normalized, 'sha256'), 'hex')`. */
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Begin TOTP enrolment. Returns { factorId, qrCode (SVG), secret, uri }. */
export async function enrollTotp() {
  // Clear any unverified factors left by an abandoned attempt - otherwise
  // Supabase rejects the new one ("friendly name already exists").
  const { data: list } = await supabase.auth.mfa.listFactors()
  for (const f of (list?.all || []).filter(f => f.status !== 'verified')) {
    try { await supabase.auth.mfa.unenroll({ factorId: f.id }) } catch { /* ignore */ }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${Date.now()}`,
  })
  if (error) throw error
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  }
}

/** Verify a 6-digit code for a factor. Elevates the session to AAL2 on success. */
export async function verifyTotp(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: String(code || '').trim(),
  })
  if (error) throw error
}

/** Remove a factor (used to cancel an abandoned enrolment, or to disable 2FA). */
export async function unenrollFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

/** The user's verified TOTP factor id, or null if 2FA is off. */
export async function getVerifiedTotpFactorId() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  const totp = (data?.totp || []).find(f => f.status === 'verified')
  return totp?.id ?? null
}

/** True while the current session has passed the password but not yet 2FA. */
export async function needsMfaChallenge() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
}

/** Replace the user's backup codes. Returns the plaintext codes to show once. */
export async function regenerateBackupCodes(userId) {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateRecoveryCode())
  const rows = await Promise.all(
    codes.map(async code => ({
      user_id: userId,
      code_hash: await sha256Hex(normalizeRecoveryCode(code)),
    }))
  )
  await supabase.from('mfa_backup_codes').delete().eq('user_id', userId)
  const { error } = await supabase.from('mfa_backup_codes').insert(rows)
  if (error) throw error
  return codes
}

/** How many unused backup codes remain. */
export async function countUnusedBackupCodes() {
  const { count, error } = await supabase
    .from('mfa_backup_codes')
    .select('id', { count: 'exact', head: true })
    .is('used_at', null)
  if (error) throw error
  return count ?? 0
}

/** Redeem a backup code from an AAL1 session. On success 2FA is removed. */
export async function redeemBackupCode(code) {
  const { data, error } = await supabase.rpc('redeem_mfa_backup_code', { code })
  if (error) throw error
  if (data === true) {
    // The factor is gone server-side, but the current token still expects
    // AAL2. Refresh so getAuthenticatorAssuranceLevel() stops requiring 2FA
    // (otherwise the challenge would keep reappearing).
    try { await supabase.auth.refreshSession() } catch { /* ignore */ }
  }
  return data === true
}
