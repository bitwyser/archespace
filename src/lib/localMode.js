/**
 * localMode.js - Local mode: ArcheSpace without an account. Everything is
 * kept in this browser (IndexedDB, see lib/local/) and nothing is sent to a
 * server. The data is still encrypted with the vault PIN.
 *
 * The mode is chosen once, at startup (lib/supabase.js picks the local or the
 * Supabase client from it), so entering or leaving it reloads the app.
 */

const MODE_KEY = 'arche:local-mode'

/** The stand-in user every local row belongs to. */
export const LOCAL_USER = Object.freeze({
  id: '00000000-0000-4000-8000-000000000000',
  email: null,
  local: true,
  app_metadata: {},
  user_metadata: {},
})

export function isLocalMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'on'
  } catch {
    return false
  }
}

/** How "sign out" reads: in local mode it leaves the mode, and the data stays. */
export const SIGN_OUT_TEXT = isLocalMode()
  ? {
      label: 'Leave local mode',
      title: 'Leave local mode?',
      message: 'Your data stays in this browser. Choose "Use without an account" on the sign-in page to come back to it.',
      done: 'Left local mode',
    }
  : {
      label: 'Sign out',
      title: 'Sign out?',
      message: "You'll need your login password and vault PIN to sign back in.",
      done: 'Signed out',
    }

/** Switch this browser to local mode and open the app. */
export function enterLocalMode() {
  localStorage.setItem(MODE_KEY, 'on')
  // Ask the browser not to clear the data under storage pressure.
  navigator.storage?.persist?.().catch(() => {})
  window.location.assign('/app')
}

/** Leave local mode (the data stays for next time) and go to sign in. */
export function leaveLocalMode() {
  try {
    localStorage.removeItem(MODE_KEY)
  } catch {
    // Storage unavailable: nothing to clear.
  }
  window.location.assign('/login')
}
