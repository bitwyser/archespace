/**
 * supabase.js - Supabase client singleton.
 *
 * Reads the project URL and anonymous API key from Vite
 * environment variables (prefixed VITE_ so they are exposed
 * to the client bundle). These must be set in a `.env` file
 * at the project root (see `.env.example`).
 *
 * The returned `supabase` instance is shared across the entire
 * app - never create a second client.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── P0 Security: Validate env vars at startup ──
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Must match supabase-js's current default exactly, or existing sessions
    // are lost once (do not change this value casually).
    storageKey: `sb-${projectRef}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
