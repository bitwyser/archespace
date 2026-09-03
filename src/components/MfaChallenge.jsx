/**
 * MfaChallenge.jsx - Second-factor step shown after the password, before the
 * vault. Accepts a 6-digit authenticator code, or a one-time backup code
 * (which removes 2FA so a user who lost their authenticator can get back in).
 */
import { useState } from 'react'
import { ShieldCheck, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContextCore'
import { getVerifiedTotpFactorId, verifyTotp, redeemBackupCode, validateTotpCode, normalizeTotpCode, TOTP_CODE_LENGTH } from '../lib/mfa'
import { validateRecoveryCode, normalizeRecoveryCode } from '../lib/crypto/recoveryCode'

export default function MfaChallenge({ onVerified }) {
  const { signOut } = useAuth()
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    // Validate format up front so obvious mistakes get a specific message
    // instead of a generic rejection from the server.
    const validationError = useBackup ? validateRecoveryCode(code) : validateTotpCode(code)
    if (validationError) {
      setError(validationError)
      return
    }
    const normalized = useBackup ? normalizeRecoveryCode(code) : normalizeTotpCode(code)
    setError('')
    setLoading(true)
    try {
      if (useBackup) {
        const ok = await redeemBackupCode(normalized)
        if (!ok) {
          setError('That backup code is not valid or has already been used.')
          setLoading(false)
          return
        }
        onVerified({ backupUsed: true })
        return
      }
      const factorId = await getVerifiedTotpFactorId()
      if (!factorId) {
        onVerified()
        return
      }
      await verifyTotp(factorId, normalized)
      onVerified()
    } catch (err) {
      setError(err?.message || 'Verification failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
            {useBackup ? <KeyRound size={24} className="text-accent" /> : <ShieldCheck size={24} className="text-accent" />}
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Two-factor authentication</h1>
          <p className="text-sm text-text-muted mt-1.5">
            {useBackup
              ? 'Enter your backup code. This turns off two-factor authentication so you can sign in - set it up again afterwards in Settings.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>

        <form onSubmit={submit} className="bg-bg-surface border border-bg-border rounded-2xl p-5 space-y-4">
          <input
            autoFocus
            value={code}
            onChange={e => { setCode(useBackup ? e.target.value : normalizeTotpCode(e.target.value)); setError('') }}
            inputMode={useBackup ? 'text' : 'numeric'}
            maxLength={useBackup ? 24 : TOTP_CODE_LENGTH}
            autoComplete="one-time-code"
            placeholder={useBackup ? 'Backup code' : '123456'}
            className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-base text-text-primary text-center tracking-[0.3em] font-mono focus:outline-none focus:border-accent"
          />
          {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => { setUseBackup(v => !v); setCode(''); setError('') }}
            className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            {useBackup ? 'Use authenticator code' : 'Use a backup code'}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="block mx-auto text-xs text-text-muted hover:text-text-primary"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
