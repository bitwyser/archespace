/**
 * AuthContext.jsx - Authentication provider for ArcheSpace.
 *
 * Wraps the app in a React context that exposes:
 *   - `user`    - the current Supabase User object (or null)
 *   - `loading` - true while the initial session check is in flight
 *   - `signIn`  - sign in with email + password
 *   - `signOut` - end the session
 *
 * On mount the provider:
 *   1. Fetches the existing session (e.g. from a stored refresh token).
 *   2. Subscribes to auth state changes so the UI stays in sync
 *      when tokens refresh or the user signs out in another tab.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearVaultSession } from '../lib/crypto/vaultSession'
import { clearOfflineCache } from '../lib/offlineCache'
import { logAudit } from '../lib/auditLog'
import { AuthContext } from './AuthContextCore'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    // 1. Hydrate from the persisted session (cookie / localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 2. Listen for future auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setPasswordRecovery(false)
      }
    )

    // Cleanup: unsubscribe on unmount
    return () => subscription.unsubscribe()
  }, [])

  /** Sign in with email/password credentials */
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  /** Register a new account (multi-user mode) */
  const signUp = (email, password, metadata = {}) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })

  /** Send a password reset email. */
  const requestPasswordReset = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  /** Send a reauthentication code (OTP) to the user's current email. */
  const reauthenticate = () => supabase.auth.reauthenticate()

  /**
   * Request an account email change through Supabase Auth.
   * Pass the reauthentication `nonce` (code sent to the current email) so
   * the change is authorised. With Supabase "Secure email change" disabled,
   * only the new address receives a confirmation link.
   */
  const updateEmail = (email, nonce) =>
    supabase.auth.updateUser(
      nonce ? { email, nonce } : { email },
      { emailRedirectTo: `${window.location.origin}/login?email_change=verified` }
    )

  /** Permanently delete the signed-in user's account through a database RPC. */
  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_current_user')
    if (error) return { error }
    clearVaultSession()
    setPasswordRecovery(false)
    await supabase.auth.signOut({ scope: 'local' })
    setUser(null)
    return { error: null }
  }

  /** Update password, revoke all sessions, and force a fresh sign-in. */
  const updatePasswordAndSignOut = async (password, afterUpdate, nonce) => {
    const { error: updateError } = await supabase.auth.updateUser(
      nonce ? { password, nonce } : { password }
    )
    if (updateError) return { error: updateError }
    if (afterUpdate) {
      try {
        await afterUpdate()
      } catch (error) {
        return { error }
      }
    }

    clearVaultSession()
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
    if (!signOutError) setPasswordRecovery(false)
    return { error: signOutError }
  }

  /**
   * End the current session. Defaults to `local` scope so signing out on one
   * device does NOT revoke the user's sessions on their other devices - only
   * this browser is signed out. Callers can still pass an explicit scope.
   * (Global, all-device revocation is intentional only for password changes,
   * handled separately in updatePasswordAndSignOut.)
   */
  const signOut = async (options = { scope: 'local' }) => {
    // Record the logout while the session (and auth.uid()) is still valid.
    await logAudit({ action: 'logout' })
    clearVaultSession()
    clearOfflineCache() // fire-and-forget; ciphertext-only but no need to keep it
    setPasswordRecovery(false)
    return supabase.auth.signOut(options)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        reauthenticate,
        updateEmail,
        deleteAccount,
        updatePasswordAndSignOut,
        passwordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
