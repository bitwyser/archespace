/**
 * PasswordResetPage.jsx - Complete Supabase password recovery.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContextCore'
import { useTheme } from '../context/ThemeCore'
import { PASSWORD_RULES, validatePassword } from '../lib/passwordPolicy'
import { logAudit } from '../lib/auditLog'
import { useRouteMeta } from '../hooks/useRouteMeta'
import { Spinner } from '../components/ui/UI'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  useRouteMeta({ title: 'Reset password' })
  const { user, loading, passwordRecovery, updatePasswordAndSignOut } = useAuth()
  const { theme, themes, toggle } = useTheme()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const currentThemeName = themes.find(option => option.id === theme)?.name || 'Theme'

  // Live requirements + match, shown as the user types (Postel's Law: explain
  // requirements before submission; Doherty: immediate feedback).
  const passwordChecks = [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, ok: password.length >= PASSWORD_RULES.minLength },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
  ]
  const confirmMatches = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit = Boolean(password && confirmPassword)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const { error: updateError } = await updatePasswordAndSignOut(
      password,
      () => logAudit({ action: 'password_reset' })
    )
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/login?reset=success', { replace: true })
  }

  return (
    <div className="min-h-[100svh] bg-bg-base flex items-start sm:items-center justify-center px-4 pt-16 pb-6 sm:p-4 relative overflow-y-auto overflow-x-hidden">
      <button
        type="button"
        onClick={toggle}
        className="absolute top-4 right-4 p-2.5 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all z-50"
        title={`Current theme: ${currentThemeName}`}
        aria-label="Switch app theme"
      >
        <Sparkles size={16} />
      </button>

      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <div className="text-center mb-6 sm:mb-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-accent/10">
            <KeyRound size={24} className="text-accent" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-1.5 sm:mb-2">Reset Password</h1>
          <p className="text-text-muted text-sm">Choose a new login password.</p>
        </div>

        <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 shadow-xl shadow-black/10">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size={20} />
            </div>
          ) : !user || !passwordRecovery ? (
            <div className="space-y-4">
              <div role="alert" className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                <p className="text-danger text-xs">This reset link is missing or expired. Request a new password reset link.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full bg-accent hover:bg-accent-hover text-[#0c1a16] rounded-xl px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="reset-password" className="block text-xs font-medium text-text-secondary mb-1.5">New password</label>
                <div className="relative">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                    required
                    autoFocus
                    minLength={PASSWORD_RULES.minLength}
                    autoComplete="new-password"
                    className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  {passwordChecks.map(check => (
                    <li
                      key={check.label}
                      className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                        check.ok ? 'text-success' : 'text-text-muted'
                      }`}
                    >
                      {check.ok ? (
                        <Check size={12} className="shrink-0" />
                      ) : (
                        <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                      )}
                      {check.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-xs font-medium text-text-secondary mb-1.5">Confirm password</label>
                <input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (error) setError('') }}
                  required
                  autoComplete="new-password"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                />
                {confirmPassword.length > 0 && (
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${
                      confirmMatches ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {confirmMatches ? <Check size={12} /> : null}
                    {confirmMatches ? 'Passwords match' : 'Passwords do not match'}
                  </p>
                )}
              </div>

              {error && (
                <div role="alert" className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-shake">
                  <p className="text-danger text-xs">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="w-full bg-accent hover:bg-accent-hover text-[#0c1a16] rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1 active:scale-[0.98] shadow-lg shadow-accent/20"
              >
                <KeyRound size={14} />
                {saving ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
