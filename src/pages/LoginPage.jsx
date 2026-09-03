/**
 * LoginPage.jsx - Sign in and (optional) sign up.
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContextCore'
import { Lock, Eye, EyeOff, UserPlus, Mail, ArrowLeft, Home } from 'lucide-react'
import { MAX_LOGIN_ATTEMPTS, LOGIN_ATTEMPT_WINDOW_MS, LOGIN_COOLDOWN_MS } from '../lib/constants'
import { MULTI_USER_ENABLED } from '../lib/appConfig'
import { PASSWORD_RULES, validatePassword } from '../lib/passwordPolicy'
import { logAudit } from '../lib/auditLog'
import {
  recordClientRateLimitFailure,
  clearClientRateLimit,
  getClientRateLimitStatus,
} from '../lib/rateLimiter'

function getInitialInfo(searchParams) {
  if (searchParams.get('reset') === 'success') {
    return 'Password updated. Please sign in with your new password.'
  }
  if (searchParams.get('email_change') === 'requested') {
    return 'Email change requested. Check your current and new email inboxes, then sign in again.'
  }
  if (searchParams.get('email_change') === 'verified') {
    return 'Email confirmation received. If another confirmation email was sent, open that link too, then sign in with your new email.'
  }
  if (searchParams.get('account_deleted') === '1') {
    return 'Your account was permanently deleted.'
  }
  return ''
}

export default function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(() => getInitialInfo(searchParams))
  const [loading, setLoading] = useState(false)

  const [, setCooldownTick] = useState(0)

  const loginRateKey = email.trim().toLowerCase() ? `login:${email.trim().toLowerCase()}` : 'login:anonymous'

  const cooldownStatus = getClientRateLimitStatus(loginRateKey, MAX_LOGIN_ATTEMPTS)
  const cooldownRemaining = cooldownStatus.blocked ? cooldownStatus.retryAfter * 1000 : 0
  const isCoolingDown = cooldownRemaining > 0

  useEffect(() => {
    if (!isCoolingDown) return
    const timer = setInterval(() => setCooldownTick(tick => tick + 1), 1000)
    return () => clearInterval(timer)
  }, [isCoolingDown, loginRateKey])

  const isSignUp = mode === 'signup' && MULTI_USER_ENABLED
  const isForgot = mode === 'forgot'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if ((!isForgot && isCoolingDown) || loading) return

    if (!isForgot) {
      const status = getClientRateLimitStatus(loginRateKey, MAX_LOGIN_ATTEMPTS)
      if (status.blocked) {
        setCooldownTick(tick => tick + 1)
        setError(`Too many failed attempts. Please wait ${status.retryAfter} seconds.`)
        return
      }
    }

    setError('')
    setInfo('')

    if (isForgot) {
      if (!email.trim()) {
        setError('Enter your email address.')
        return
      }
      setLoading(true)
      // Ignore the result on purpose: showing the same confirmation whether or
      // not the address is registered prevents account enumeration. (Supabase
      // also succeeds silently for unknown emails.)
      await requestPasswordReset(email).catch(() => {})
      setLoading(false)
      setInfo("If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder.")
      return
    }

    if (isSignUp) {
      const passwordError = validatePassword(password)
      if (passwordError) {
        setError(passwordError)
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      setLoading(true)
      const { data, error: signUpError } = await signUp(email, password)
      setLoading(false)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      if (data.session) {
        setInfo('Account created. Set your vault PIN on the next screen.')
        return
      }
      // Shown identically whether the email is new or already registered, so it
      // never reveals which - preventing account enumeration.
      setInfo('Check your email to confirm your address and finish signing up. Already have an account? Sign in instead.')
      setMode('signin')
      setPassword('')
      setConfirmPassword('')
      return
    }

    setLoading(true)
    const { error: signInError } = await signIn(email, password)
    if (signInError) {
      recordClientRateLimitFailure(loginRateKey, MAX_LOGIN_ATTEMPTS, LOGIN_ATTEMPT_WINDOW_MS, LOGIN_COOLDOWN_MS)
      const status = getClientRateLimitStatus(loginRateKey, MAX_LOGIN_ATTEMPTS)
      setError(signInError.message)
      if (status.blocked) {
        setCooldownTick(tick => tick + 1)
        setError(`Too many failed attempts. Please wait ${status.retryAfter} seconds.`)
      }
      setLoading(false)
      return
    }

    logAudit({ action: 'login' })
    clearClientRateLimit(loginRateKey)
    setCooldownTick(tick => tick + 1)

    setLoading(false)
  }

  return (
    <div className="min-h-[100svh] bg-bg-base flex items-start sm:items-center justify-center px-4 pt-16 pb-6 sm:p-4 relative overflow-y-auto overflow-x-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-[0.03] blur-3xl animate-float-slow"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-[0.03] blur-3xl animate-float-slow-reverse"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
      </div>

      <Link
        to="/"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all z-50 text-sm font-medium"
        aria-label="Go to home page"
      >
        <Home size={16} />
        <span className="hidden sm:inline">Home</span>
      </Link>

      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <div className="text-center mb-6 sm:mb-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-accent/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              <path d="M8 7h6" />
              <path d="M8 11h8" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-widest mb-1.5 sm:mb-2">ArcheSpace</h1>
          <p className="text-text-muted text-sm">
            {MULTI_USER_ENABLED ? 'Sign in or create an account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 shadow-xl shadow-black/10">
          {MULTI_USER_ENABLED && (
            <div className="flex gap-1 p-1 bg-bg-elevated rounded-xl mb-4">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setInfo('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'signin' ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setInfo('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'signup' ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Create account
              </button>
            </div>
          )}

          {isForgot && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setInfo('') }}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors mb-4"
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                disabled={!isForgot && isCoolingDown}
                className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm disabled:opacity-50"
              />
            </div>
            {!isForgot && (
              <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  disabled={isCoolingDown}
                  minLength={isSignUp ? PASSWORD_RULES.minLength : undefined}
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm disabled:opacity-50"
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
              </div>
            )}

            {isSignUp && (
              <div>
                <label htmlFor="login-confirm" className="block text-xs font-medium text-text-secondary mb-1.5">Confirm password</label>
                <input
                  id="login-confirm"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                />
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-shake">
                <p className="text-danger text-xs">{error}</p>
              </div>
            )}

            {info && (
              <div className="bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                <p className="text-success text-xs">{info}</p>
              </div>
            )}

            {isCoolingDown && !isSignUp && !isForgot && (
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                <p className="text-amber-400 text-xs">
                  Try again in {Math.ceil(cooldownRemaining / 1000)}s
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isCoolingDown && !isSignUp && !isForgot)}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1 active:scale-[0.98] shadow-lg shadow-accent/20"
            >
              {isForgot ? <Mail size={14} /> : isSignUp ? <UserPlus size={14} /> : <Lock size={14} />}
              {loading
                ? (isForgot ? 'Sending link…' : isSignUp ? 'Creating account…' : 'Signing in…')
                : isCoolingDown && !isSignUp && !isForgot
                  ? 'Locked'
                  : isForgot
                    ? 'Send reset link'
                    : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
            </button>

            {!isSignUp && !isForgot && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
                className="w-full text-center text-xs text-text-muted hover:text-accent transition-colors pt-1"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-4 sm:mt-6">
          {MULTI_USER_ENABLED ? 'Multi-user · Private · Encrypted' : 'Single-user · Private · Encrypted'}
        </p>
      </div>
    </div>
  )
}
