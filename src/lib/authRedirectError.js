/**
 * authRedirectError.js - Surface failed Supabase email links.
 *
 * When an email link (sign-up confirmation, magic link, invite, email change,
 * password reset) is expired, already used or denied, Supabase redirects back
 * with `error`, `error_code` and `error_description` in the query string and/or
 * the URL hash.
 *
 * This module runs once at startup - imported first in main.jsx, before the
 * router and the Supabase client read the URL - to capture the error, remove it
 * from the address bar, and hold a friendly message for the UI:
 *   - signed out: the login page shows it (a failed link on `/` is sent there)
 *   - signed in:  AuthLinkErrorToast (App.jsx) shows it as a toast
 * The reset-password page already explains an expired reset link itself.
 */

const ERROR_KEYS = ['error', 'error_code', 'error_description', 'sb']

let pending = null

function friendlyMessage(code, description) {
  if (code === 'otp_expired') {
    return 'That email link is invalid or has expired. Links work once and expire after a while, so request a new one.'
  }
  return description || "That email link couldn't be used. Please try again."
}

function capture() {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  const query = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const hasError = p => p.has('error') || p.has('error_code') || p.has('error_description')
  const source = [query, hashParams].find(hasError)
  if (!source) return

  // URLSearchParams decodes "+" to spaces, so the description reads naturally.
  const code = source.get('error_code') || source.get('error') || ''
  const message = friendlyMessage(code, source.get('error_description') || '')

  for (const key of ERROR_KEYS) query.delete(key)
  // A failed email-change link must not show the "email confirmed" notice.
  query.delete('email_change')

  let nextPath = pathname
  if (pathname !== '/reset-password') {
    pending = message
    // Links without their own redirect (sign-up confirmation, magic link)
    // land on the home page; the login page is where the message belongs.
    if (pathname === '/') nextPath = '/login'
  }

  // The hash only ever carried the auth params, so drop it entirely.
  const qs = query.toString()
  window.history.replaceState(window.history.state, '', nextPath + (qs ? `?${qs}` : ''))
}

capture()

/** The failed email-link message captured at startup, if any (not cleared). */
export function peekAuthRedirectError() {
  return pending
}

/** Mark the captured message as shown so it isn't displayed again. */
export function clearAuthRedirectError() {
  pending = null
}
