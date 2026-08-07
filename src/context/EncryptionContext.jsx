/**
 * EncryptionContext.jsx - In-memory vault master key for client-side E2E encryption.
 *
 * The master AES key is unlocked with a vault PIN (independent of login password).
 * While signed in, the unlocked key is kept in sessionStorage so refresh does not
 * require re-entering the PIN until manual lock or 24-hour auto-lock.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContextCore'
import { EncryptionContext } from './EncryptionCore'
import {
  setupUserVault,
  unlockUserVault,
  changeVaultPinWithVerification,
  createVaultRecoveryCode,
  changeVaultPinWithRecoveryCode,
  recoverVaultWithRecoveryCode,
  getVaultStatus,
} from '../lib/crypto/vault'
import {
  saveVaultSession,
  loadVaultSession,
  clearVaultSession,
  VAULT_UNLOCKED_AT_KEY,
} from '../lib/crypto/vaultSession'
import { isPasskeySupported } from '../lib/crypto/passkey'
import {
  listPasskeys,
  enrollPasskey as enrollPasskeyVault,
  unlockVaultWithPasskey,
  removePasskey as removePasskeyVault,
} from '../lib/crypto/passkeyVault'
import { VAULT_AUTO_LOCK_MS, VAULT_PIN_LOCKOUT_MS, VAULT_PIN_MAX_ATTEMPTS } from '../lib/constants'
import {
  getClientRateLimitStatus,
  recordClientRateLimitFailure,
  clearClientRateLimit,
} from '../lib/rateLimiter'
import { logAudit } from '../lib/auditLog'

const VAULT_STATUS_TIMEOUT_MS = 8000
const VAULT_SESSION_RESTORE_TIMEOUT_MS = 4000

function withTimeout(promise, ms, message) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

export function EncryptionProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [cryptoKey, setCryptoKey] = useState(null)
  const [unlocking, setUnlocking] = useState(false)
  const [sessionRestoring, setSessionRestoring] = useState(true)
  const [unlockError, setUnlockError] = useState('')
  const [vaultStatus, setVaultStatus] = useState({
    loading: true,
    hasVault: false,
  })
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeys, setPasskeys] = useState([])

  const refreshVaultStatus = useCallback(async () => {
    if (!userId) {
      setVaultStatus({ loading: false, hasVault: false })
      return
    }
    setVaultStatus(s => ({ ...s, loading: true }))
    try {
      const status = await withTimeout(
        getVaultStatus(userId),
        VAULT_STATUS_TIMEOUT_MS,
        'Vault status check timed out.'
      )
      setVaultStatus({ loading: false, ...status })
    } catch (error) {
      console.warn('Failed to check vault status:', error)
      setVaultStatus({ loading: false, hasVault: true })
    }
  }, [userId])

  useEffect(() => {
    const timer = setTimeout(refreshVaultStatus, 0)
    return () => clearTimeout(timer)
  }, [refreshVaultStatus])

  // Detect platform-authenticator (biometric) support once on mount.
  useEffect(() => {
    let active = true
    isPasskeySupported().then(supported => {
      if (active) setPasskeySupported(supported)
    })
    return () => { active = false }
  }, [])

  const refreshPasskeys = useCallback(async () => {
    if (!userId) {
      setPasskeys([])
      return
    }
    try {
      setPasskeys(await listPasskeys(userId))
    } catch (error) {
      console.warn('Failed to load passkeys:', error)
      setPasskeys([])
    }
  }, [userId])

  useEffect(() => {
    const timer = setTimeout(refreshPasskeys, 0)
    return () => clearTimeout(timer)
  }, [refreshPasskeys])

  const lock = useCallback((reason) => {
    clearVaultSession()
    setCryptoKey(null)
    setUnlockError('')
    // `reason` is a string for programmatic calls ('auto'); when lock is
    // wired directly to an onClick it receives an event, so default to 'manual'.
    logAudit({ action: 'vault_lock', details: { reason: typeof reason === 'string' ? reason : 'manual' } })
  }, [])

  const applyUnlockedKey = useCallback(async (key) => {
    if (userId) await saveVaultSession(userId, key)
    setCryptoKey(key)
  }, [userId])

  const unlock = useCallback(async (pin) => {
    if (!userId) throw new Error('Not signed in')

    const rateKey = `vault-unlock:${userId}`
    const status = getClientRateLimitStatus(rateKey, VAULT_PIN_MAX_ATTEMPTS)
    if (status.blocked) {
      const msg = `Too many failed PIN attempts. Try again in ${status.retryAfter} seconds.`
      setUnlockError(msg)
      throw new Error(msg)
    }

    setUnlocking(true)
    setUnlockError('')
    try {
      const key = await unlockUserVault(userId, pin)
      clearClientRateLimit(rateKey)
      await applyUnlockedKey(key)
      logAudit({ action: 'vault_unlock' })
      return key
    } catch (err) {
      const msg = err?.message || "Couldn't unlock vault."
      if (msg.includes('Incorrect PIN') || msg.includes('cannot unlock')) {
        recordClientRateLimitFailure(rateKey, VAULT_PIN_MAX_ATTEMPTS, VAULT_PIN_LOCKOUT_MS)
      }
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  // Verify a re-entered PIN without changing session state (used to reveal
  // "secret" items). Shares the vault-unlock rate limiter + server lockout, so
  // a wrong reveal PIN counts like a wrong unlock. Returns true if correct.
  const verifyVaultPin = useCallback(async (pin) => {
    if (!userId) return false
    const rateKey = `vault-unlock:${userId}`
    const status = getClientRateLimitStatus(rateKey, VAULT_PIN_MAX_ATTEMPTS)
    if (status.blocked) {
      throw new Error(`Too many failed PIN attempts. Try again in ${status.retryAfter} seconds.`)
    }
    try {
      await unlockUserVault(userId, pin)
      clearClientRateLimit(rateKey)
      return true
    } catch (err) {
      const msg = err?.message || ''
      if (msg.includes('Incorrect PIN') || msg.includes('cannot unlock')) {
        recordClientRateLimitFailure(rateKey, VAULT_PIN_MAX_ATTEMPTS, VAULT_PIN_LOCKOUT_MS)
        return false
      }
      throw err
    }
  }, [userId])

  // Unlock the vault with an enrolled passkey (biometric prompt). Falls back to
  // PIN on any failure; the PIN path and recovery code remain the source of truth.
  const unlockWithPasskey = useCallback(async () => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const key = await unlockVaultWithPasskey(userId)
      await applyUnlockedKey(key)
      logAudit({ action: 'vault_unlock', details: { method: 'passkey' } })
      return key
    } catch (err) {
      const msg = err?.message || "Couldn't unlock with passkey."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  // Enroll a passkey. Re-verifies the current PIN to obtain an exportable master
  // key (mirrors recovery-code setup), then wraps it with the passkey's PRF secret.
  const enrollPasskey = useCallback(async (pin, label) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const key = await enrollPasskeyVault(userId, pin, user?.email || 'Arche vault', label)
      await applyUnlockedKey(key)
      await refreshPasskeys()
      logAudit({ action: 'vault_passkey_enroll' })
    } catch (err) {
      const msg = err?.message || "Couldn't add passkey."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, user, applyUnlockedKey, refreshPasskeys])

  const removePasskey = useCallback(async (id) => {
    if (!userId) throw new Error('Not signed in')
    await removePasskeyVault(userId, id)
    await refreshPasskeys()
    logAudit({ action: 'vault_passkey_remove' })
  }, [userId, refreshPasskeys])

  const setup = useCallback(async (pin) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const { masterKey, recoveryCode, recoveryUnavailable } = await setupUserVault(userId, pin)
      await applyUnlockedKey(masterKey)
      await refreshVaultStatus()
      logAudit({ action: 'vault_setup' })
      return { recoveryCode, recoveryUnavailable }
    } catch (err) {
      const msg = err?.message || "Couldn't set up vault."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey, refreshVaultStatus])

  const updatePin = useCallback(async (currentPin, newPin) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const key = await changeVaultPinWithVerification(userId, currentPin, newPin)
      await applyUnlockedKey(key)
      logAudit({ action: 'vault_pin_change' })
    } catch (err) {
      const msg = err?.message || "Couldn't change PIN."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  const setupRecoveryCode = useCallback(async (currentPin) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const { masterKey, recoveryCode } = await createVaultRecoveryCode(userId, currentPin)
      await applyUnlockedKey(masterKey)
      logAudit({ action: 'recovery_code_created' })
      return { recoveryCode }
    } catch (err) {
      const msg = err?.message || "Couldn't set up recovery code."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  const updatePinWithRecoveryCode = useCallback(async (recoveryCode, newPin) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const { masterKey, recoveryCode: nextRecoveryCode } =
        await changeVaultPinWithRecoveryCode(userId, recoveryCode, newPin)
      await applyUnlockedKey(masterKey)
      logAudit({ action: 'vault_pin_reset' })
      return { recoveryCode: nextRecoveryCode }
    } catch (err) {
      const msg = err?.message || "Couldn't change PIN."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  const recoverPinWithCode = useCallback(async (recoveryCode, newPin) => {
    if (!userId) throw new Error('Not signed in')
    setUnlocking(true)
    setUnlockError('')
    try {
      const { masterKey, recoveryCode: nextRecoveryCode } =
        await recoverVaultWithRecoveryCode(userId, recoveryCode, newPin)
      await applyUnlockedKey(masterKey)
      logAudit({ action: 'vault_pin_reset' })
      return { recoveryCode: nextRecoveryCode }
    } catch (err) {
      const msg = err?.message || "Couldn't recover vault PIN."
      setUnlockError(msg)
      throw err
    } finally {
      setUnlocking(false)
    }
  }, [userId, applyUnlockedKey])

  // Wait for auth hydration before clearing or restoring vault session.
  // Clearing while user is briefly null on refresh was wiping sessionStorage.
  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      clearVaultSession()
      const timer = setTimeout(() => {
        setCryptoKey(null)
        setSessionRestoring(false)
      }, 0)
      return () => clearTimeout(timer)
    }

    let cancelled = false
    const restoringTimer = setTimeout(() => {
      if (!cancelled) setSessionRestoring(true)
    }, 0)
    withTimeout(
      loadVaultSession(userId),
      VAULT_SESSION_RESTORE_TIMEOUT_MS,
      'Vault session restore timed out.'
    )
      .catch((error) => {
        console.warn('Failed to restore vault session:', error)
        clearVaultSession()
        return null
      })
      .then(key => {
        if (cancelled) return
        clearTimeout(restoringTimer)
        if (key) setCryptoKey(key)
        setSessionRestoring(false)
      })
    return () => {
      cancelled = true
      clearTimeout(restoringTimer)
    }
  }, [userId, authLoading])

  const lockRef = useRef(lock)

  useEffect(() => {
    lockRef.current = lock
  }, [lock])

  useEffect(() => {
    if (!cryptoKey) return

    const stored = sessionStorage.getItem(VAULT_UNLOCKED_AT_KEY)
    const unlockedAt = stored ? Number(stored) : Date.now()
    if (!stored) sessionStorage.setItem(VAULT_UNLOCKED_AT_KEY, String(unlockedAt))

    const remaining = VAULT_AUTO_LOCK_MS - (Date.now() - unlockedAt)
    if (remaining <= 0) {
      lockRef.current('auto')
      window.dispatchEvent(new CustomEvent('arche:vault-auto-locked'))
      return
    }

    const timer = setTimeout(() => {
      lockRef.current('auto')
      window.dispatchEvent(new CustomEvent('arche:vault-auto-locked'))
    }, remaining)

    return () => clearTimeout(timer)
  }, [cryptoKey])

  const isUnlocked = !!cryptoKey && !!user

  return (
    <EncryptionContext.Provider
      value={{
        cryptoKey,
        isUnlocked,
        unlocking,
        sessionRestoring,
        unlockError,
        vaultStatus,
        unlock,
        verifyVaultPin,
        setup,
        updatePin,
        setupRecoveryCode,
        updatePinWithRecoveryCode,
        recoverPinWithCode,
        lock,
        refreshVaultStatus,
        passkeySupported,
        passkeys,
        unlockWithPasskey,
        enrollPasskey,
        removePasskey,
        refreshPasskeys,
        clearUnlockError: () => setUnlockError(''),
      }}
    >
      {children}
    </EncryptionContext.Provider>
  )
}
