/**
 * Shared Supabase client singleton. Configured from the VITE_SUPABASE_* env
 * vars (see `.env.example`); never create a second client.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Arche] Missing Supabase configuration.\n' +
    'Create a .env file in the project root with:\n' +
    '  VITE_SUPABASE_URL=https://your-project-id.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key-here\n' +
    'See .env.example for reference.'
  )
}

// Pin the auth storage key instead of letting supabase-js derive it at runtime.
// The default is `sb-<project-ref>-auth-token`, computed from the URL. If a
// future supabase-js upgrade (shipped on a normal deploy) changes that
// derivation, every user's saved session would be orphaned under the old key
// and they'd all be logged out on the next build. Pinning to the CURRENT
// default keeps existing sessions valid now and stable across upgrades.
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

// "Remember me" preference. When true (default), the auth token lives in
// localStorage and survives a browser restart; when false, it lives in
// sessionStorage and is dropped when the browser closes. Read at each token
// write, so setRememberMe() before signing in routes the session correctly.
const REMEMBER_KEY = 'arche-remember-me'

function rememberMe() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'false'
  } catch {
    return true
  }
}

/** Set before signing in to choose persistent (true) vs session-only (false). */
export function setRememberMe(value) {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? 'true' : 'false')
  } catch {
    // Storage unavailable (private mode); fall back to the default (persist).
  }
}

// Routes the auth token to localStorage or sessionStorage per the preference.
// Reads prefer whichever store holds it, so existing localStorage sessions stay
// valid and switching stores between logins works cleanly.
const authStorage = {
  getItem(key) {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      if (rememberMe()) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {
      // Ignore write failures (private mode / quota).
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // Ignore.
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Must match supabase-js's current default exactly, or existing sessions
    // are lost once (do not change this value casually).
    storageKey: `sb-${projectRef}-auth-token`,
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
