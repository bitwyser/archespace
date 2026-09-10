/**
 * LoginPage.jsx - Sign in and (optional) sign up.
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextCore'
import { Lock, Eye, EyeOff, UserPlus, Mail, ArrowLeft, Home, Check } from 'lucide-react'
import { MAX_LOGIN_ATTEMPTS, LOGIN_ATTEMPT_WINDOW_MS, LOGIN_COOLDOWN_MS } from '../lib/constants'
import { MULTI_USER_ENABLED } from '../lib/appConfig'
import { APP_VERSION } from '../lib/buildInfo'
import { BrandGlyph } from '../components/BrandGlyph'
import { PASSWORD_RULES, validatePassword } from '../lib/passwordPolicy'
import { logAudit } from '../lib/auditLog'
import { setRememberMe } from '../lib/supabase'
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
  const location = useLocation()
  const navigate = useNavigate()
  // The route decides the page: /signup is create-account, everything else is
  // sign in. "Forgot password" is a sub-state of the sign-in page.
  const pathMode = location.pathname === '/signup' ? 'signup' : 'signin'
  const [forgot, setForgot] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [remember, setRemember] = useState(true)

  // Warn if Caps Lock is on while typing a password (a common cause of a
  // rejected sign-in that the masked field hides). Postel's Law: prevent errors.
  const onPasswordKey = e => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'))
    }
  }
  const [resetSent, setResetSent] = useState(false)
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

  const isSignUp = pathMode === 'signup' && MULTI_USER_ENABLED
  const isForgot = forgot && pathMode === 'signin'

  // Live password requirements + match, shown on sign-up so the rules are
  // visible before submitting (Postel's Law) with immediate feedback (Doherty).
  const passwordChecks = [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, ok: password.length >= PASSWORD_RULES.minLength },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
  ]
  const confirmMatches = confirmPassword.length > 0 && password === confirmPassword

  // Keep the submit button disabled until the required fields are filled: email
  // for the reset flow, email + password (+ confirm on sign-up) otherwise.
  const canSubmit = isForgot
    ? Boolean(email.trim())
    : isSignUp
      ? Boolean(email.trim() && password && confirmPassword)
      : Boolean(email.trim() && password)

  // Sign-up is only reachable when multi-user mode is on; otherwise send the
  // /signup route back to sign in.
  useEffect(() => {
    if (pathMode === 'signup' && !MULTI_USER_ENABLED) {
      navigate('/login', { replace: true })
    }
  }, [pathMode, navigate])

  // Reset the form when switching between sign in and create account, so fields
  // and messages don't carry over. Skip the first render to keep any initial
  // info message (e.g. after a password reset redirect).
  const modeInitialized = useRef(false)
  useEffect(() => {
    if (!modeInitialized.current) {
      modeInitialized.current = true
      return
    }
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setForgot(false)
    setResetSent(false)
    setError('')
    setInfo('')
  }, [pathMode])

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
      setResetSent(true)
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
      setPassword('')
      setConfirmPassword('')
      return
    }

    setLoading(true)
    // Choose persistent vs session-only storage before the session is written.
    setRememberMe(remember)
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
          <div className="mx-auto mb-4 sm:mb-5 flex h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover text-[#0c1a16] shadow-lg shadow-black/20">
            <BrandGlyph className="h-[80%] w-[80%]" />
          </div>
          <p className="text-text-secondary text-sm">
            {isForgot
              ? 'Reset your password'
              : isSignUp
                ? 'Create your account'
                : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 shadow-xl shadow-black/10">
          {isForgot && resetSent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-success/20 bg-success/10">
                <Mail size={20} className="text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Check your email</p>
                <p className="mt-1.5 text-xs leading-5 text-text-muted">
                  If an account exists for{' '}
                  {email.trim() ? (
                    <span className="text-text-secondary">{email.trim()}</span>
                  ) : (
                    'that email'
                  )}
                  , we've sent a password reset link. Check your inbox and spam folder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setForgot(false); setResetSent(false); setError(''); setInfo('') }}
                className="w-full bg-accent hover:bg-accent-hover text-[#0c1a16] rounded-xl px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </div>
          ) : (
          <>
          {isForgot && (
            <>
              <button
                type="button"
                onClick={() => { setForgot(false); setResetSent(false); setError(''); setInfo('') }}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors mb-4"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
              <p className="text-xs leading-5 text-text-muted mb-4">
                Enter your account email and we'll send a link to reset your password.
              </p>
            </>
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
                onChange={e => { setEmail(e.target.value); if (error) setError('') }}
                required
                autoFocus
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
                  onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                  onKeyUp={onPasswordKey}
                  onKeyDown={onPasswordKey}
                  onBlur={() => setCapsLock(false)}
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
              {capsLock && (
                <p className="mt-1.5 text-[11px] text-amber-400">Caps Lock is on</p>
              )}
              {isSignUp && (
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
              )}
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
            )}

            {error && (
              <div role="alert" className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-shake">
                <p className="text-danger text-xs">{error}</p>
              </div>
            )}

            {info && (
              <div role="status" aria-live="polite" className="bg-success/10 border border-success/30 rounded-lg px-3 py-2">
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

            {!isSignUp && !isForgot && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-bg-border bg-bg-elevated accent-accent"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => { setForgot(true); setResetSent(false); setError(''); setInfo('') }}
                  className="text-xs text-text-muted hover:text-accent transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit || (isCoolingDown && !isSignUp && !isForgot)}
              className="w-full bg-accent hover:bg-accent-hover text-[#0c1a16] rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1 active:scale-[0.98] shadow-lg shadow-accent/20"
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

          </form>
          </>
          )}
        </div>

        {!isForgot && (isSignUp || MULTI_USER_ENABLED) && (
          <p className="text-center text-text-secondary text-sm mt-5">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="text-accent hover:underline font-medium">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to ArcheSpace?{' '}
                <Link to="/signup" className="text-accent hover:underline font-medium">
                  Create an account
                </Link>
              </>
            )}
          </p>
        )}

        <p className="text-center text-text-muted text-xs mt-4 sm:mt-6">
          Everything in Encrypted Space · v{APP_VERSION}
        </p>
      </div>
    </div>
  )
}
