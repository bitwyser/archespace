/**
 * appConfig.js - Runtime feature flags from environment.
 */

/** When true, show sign-up and allow new accounts (enable in Supabase Auth too). */
export const MULTI_USER_ENABLED = import.meta.env.VITE_ALLOW_SIGNUP === 'true'
