/**
 * VaultUnlockGate.jsx - Post-login vault PIN unlock or setup.
 */
import { useState, useEffect, useRef } from 'react'
import { Shield, Lock, Fingerprint } from 'lucide-react'
import { useAuth } from '../context/AuthContextCore'
import { useEncryption } from '../context/EncryptionCore'
import PinInput from './PinInput'
import { VAULT_PIN_MIN_LENGTH } from '../lib/constants'
import { validateVaultPin, getWeakPinWarning } from '../lib/crypto/vaultPin'
import WeakPinWarning from './WeakPinWarning'
import { ConfirmDialog } from './ui/UI'
import RecoveryCodeDialog from './RecoveryCodeDialog'

export default function VaultUnlockGate({ children }) {
  const { user, signOut, loading: authLoading } = useAuth()
  const {
    isUnlocked,
    unlock,
    setup,
    commitVaultKey,
    recoverPinWithCode,
    unlocking,
    unlockError,
    vaultStatus,
    sessionRestoring,
    clearUnlockError,
    passkeySupported,
    passkeys,
    unlockWithPasskey,
    enrollPasskey,
  } = useEncryption()

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('')
  const [oneTimeRecoveryCode, setOneTimeRecoveryCode] = useState('')
  const [recoverySetupWarning, setRecoverySetupWarning] = useState('')
  const [forgotPin, setForgotPin] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  // Which action is running, so only its button shows a spinner (not all).
  const [pendingAction, setPendingAction] = useState(null) // 'passkey' | 'pin' | null
  // When set (to the just-used PIN), show the "enable biometric unlock?" prompt
  // before letting the unlocked app through.
  const [pendingEnrollPin, setPendingEnrollPin] = useState('')
  const [enrollError, setEnrollError] = useState('')
  // Master key held between vault setup/recover and the user acknowledging the
  // one-time recovery code. The vault is only unlocked (commitVaultKey) once the
  // code is saved, so the recovery screen can never be skipped by an early
  // "unlocked" render. Mirrors the mobile flow.
  const [pendingUnlockKey, setPendingUnlockKey] = useState(null)
  // Held true while an unlock/setup/recover call is in flight and until we've
  // decided which post-action screen to show. unlock() flips isUnlocked to true
  // mid-call (before we can set the recovery-code or biometric prompt), so
  // without this the gate would briefly leak `children` and the recovery code
  // shown after setup could be skipped. See the pass-through guard below.
  const [awaitingVaultResult, setAwaitingVaultResult] = useState(false)
  // Guards the one-shot auto passkey prompt so it fires at most once per mount.
  const autoPasskeyTried = useRef(false)

  // On launch, if a passkey is enrolled on this device, prompt for it straight
  // away instead of waiting for a tap on "Unlock with passkey". Any failure
  // (cancelled, timed out, or the browser blocking the prompt) falls back to
  // the manual passkey/PIN UI below - nothing to catch here.
  useEffect(() => {
    if (autoPasskeyTried.current) return
    if (!user) return
    if (authLoading || vaultStatus.loading || sessionRestoring) return
    if (isUnlocked) return
    if (!vaultStatus.hasVault) return // setup mode: no passkey yet
    if (!passkeySupported || passkeys.length === 0) return
    if (unlocking) return
    autoPasskeyTried.current = true
    const run = async () => {
      setPendingAction('passkey')
      try {
        await unlockWithPasskey()
      } catch {
        // unlockError is set in context; the manual passkey/PIN UI takes over.
      } finally {
        setPendingAction(null)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    authLoading,
    vaultStatus.loading,
    vaultStatus.hasVault,
    sessionRestoring,
    isUnlocked,
    passkeySupported,
    passkeys.length,
  ])

  if (!user) return children
  if (authLoading || vaultStatus.loading || sessionRestoring) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <p className="text-text-muted text-sm">Loading vault…</p>
      </div>
    )
  }
  if (isUnlocked && !oneTimeRecoveryCode && !recoverySetupWarning && !pendingEnrollPin && !awaitingVaultResult) return children

  // Offer biometric enrollment only when the device supports it and the user
  // has none enrolled yet (matches the mobile "enable biometric unlock?" prompt).
  const canOfferBiometric = passkeySupported && passkeys.length === 0

  const needsSetup = !vaultStatus.hasVault

  const resetFields = () => {
    setPin('')
    setConfirmPin('')
    setRecoveryCodeInput('')
    setFormError('')
  }

  const showRecoveryCode = (recoveryCode) => {
    setOneTimeRecoveryCode(recoveryCode)
  }

  const handleUnlock = async (e) => {
    e.preventDefault()
    clearUnlockError()
    setFormError('')
    if (!pin) {
      setFormError('Enter your vault PIN.')
      return
    }
    try {
      setPendingAction('pin')
      setAwaitingVaultResult(true)
      const enteredPin = pin
      await unlock(enteredPin)
      if (canOfferBiometric) setPendingEnrollPin(enteredPin)
      resetFields()
    } catch {
      // unlockError set in context
    } finally {
      setPendingAction(null)
      setAwaitingVaultResult(false)
    }
  }

  const handlePasskeyUnlock = async () => {
    clearUnlockError()
    setFormError('')
    try {
      setPendingAction('passkey')
      await unlockWithPasskey()
      resetFields()
    } catch {
      // unlockError set in context
    } finally {
      setPendingAction(null)
    }
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    clearUnlockError()
    setFormError('')
    const err = validateVaultPin(pin)
    if (err) {
      setFormError(err)
      return
    }
    if (pin !== confirmPin) {
      setFormError('PINs do not match.')
      return
    }
    try {
      setPendingAction('pin')
      setAwaitingVaultResult(true)
      const enteredPin = pin
      const { masterKey, recoveryCode, recoveryUnavailable } = await setup(enteredPin)
      // Offer biometric enrollment after the recovery screen (render priority).
      if (canOfferBiometric) setPendingEnrollPin(enteredPin)
      if (recoveryCode) {
        // Hold the key and show the code; unlock happens on "I saved this code".
        setPendingUnlockKey(masterKey)
        showRecoveryCode(recoveryCode)
      } else {
        // No recovery code to show - unlock straight away.
        await commitVaultKey(masterKey)
        if (recoveryUnavailable) {
          setRecoverySetupWarning(
            'Your vault PIN was created, but recovery codes are not enabled in the database yet. Ask the app owner to run the recovery columns migration before relying on forgot-PIN recovery.'
          )
        }
      }
      resetFields()
    } catch {
      // unlockError set in context
    } finally {
      setPendingAction(null)
      setAwaitingVaultResult(false)
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    clearUnlockError()
    setFormError('')
    if (!recoveryCodeInput.trim()) {
      setFormError('Enter your recovery code.')
      return
    }
    const err = validateVaultPin(pin)
    if (err) {
      setFormError(err)
      return
    }
    if (pin !== confirmPin) {
      setFormError('PINs do not match.')
      return
    }
    try {
      setPendingAction('pin')
      setAwaitingVaultResult(true)
      const { masterKey, recoveryCode } = await recoverPinWithCode(recoveryCodeInput, pin)
      // Hold the key; unlock on "I saved this code" so the new code always shows.
      setPendingUnlockKey(masterKey)
      showRecoveryCode(recoveryCode)
      setForgotPin(false)
      resetFields()
    } catch {
      // unlockError set in context
    } finally {
      setPendingAction(null)
      setAwaitingVaultResult(false)
    }
  }

  // "I saved this code": unlock the vault (if setup/recover deferred it), then
  // dismiss the recovery screen so the biometric prompt or the app shows next.
  const handleAcknowledgeRecoveryCode = async () => {
    if (pendingUnlockKey) {
      await commitVaultKey(pendingUnlockKey)
      setPendingUnlockKey(null)
    }
    setOneTimeRecoveryCode('')
  }

  const handleEnableBiometric = async () => {
    setEnrollError('')
    try {
      await enrollPasskey(pendingEnrollPin)
      setPendingEnrollPin('')
      resetFields()
    } catch (err) {
      setEnrollError(err?.message || 'Could not add a passkey. You can set it up later in Settings.')
    }
  }

  const handleSkipBiometric = () => {
    setPendingEnrollPin('')
    setEnrollError('')
    resetFields()
  }

  const isNewPinMode = needsSetup || forgotPin
  const weakPinWarning = isNewPinMode && !validateVaultPin(pin) ? getWeakPinWarning(pin) : null
  const showPasskeyUnlock = !needsSetup && !forgotPin && passkeySupported && passkeys.length > 0

  if (oneTimeRecoveryCode) {
    return (
      <div className="min-h-[100svh] bg-bg-base">
        <RecoveryCodeDialog
          code={oneTimeRecoveryCode}
          busy={unlocking}
          onAcknowledge={handleAcknowledgeRecoveryCode}
        />
      </div>
    )
  }

  if (recoverySetupWarning) {
    return (
      <div className="min-h-[100svh] bg-bg-base flex items-start sm:items-center justify-center px-4 pt-16 pb-6 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Vault PIN created</h1>
              <p className="text-text-muted text-sm mt-1.5 leading-relaxed">
                {recoverySetupWarning}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRecoverySetupWarning('')}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pendingEnrollPin) {
    return (
      <div className="min-h-[100svh] bg-bg-base flex items-start sm:items-center justify-center px-4 pt-16 pb-6 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
              <Fingerprint size={24} className="text-accent" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-text-primary">Enable biometric unlock?</h1>
              <p className="text-text-muted text-sm mt-1.5 leading-relaxed">
                Use Face ID, Touch ID, or Windows Hello to unlock your vault next time, instead of typing your PIN. Your PIN still works as a backup.
              </p>
            </div>

            {enrollError && (
              <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {enrollError}
              </p>
            )}

            <button
              type="button"
              onClick={handleEnableBiometric}
              disabled={unlocking}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
            >
              <Fingerprint size={14} />
              {unlocking ? 'Waiting for device…' : 'Enable biometric unlock'}
            </button>
            <button
              type="button"
              onClick={handleSkipBiometric}
              disabled={unlocking}
              className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-bg-base flex items-start sm:items-center justify-center px-4 pt-16 pb-6 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Shield size={24} className="text-accent sm:w-[26px] sm:h-[26px]" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">
            {needsSetup ? 'Create vault PIN' : forgotPin ? 'Reset vault PIN' : 'Unlock your vault'}
          </h1>
          <p className="text-text-muted text-sm mt-1.5 sm:mt-2 leading-relaxed">
            {needsSetup
              ? `Choose a PIN or passphrase - at least ${VAULT_PIN_MIN_LENGTH} characters (letters, numbers, or symbols). A one-time recovery code will be shown next.`
              : forgotPin
                ? 'Enter your recovery code and choose a new vault PIN.'
              : 'Enter your vault PIN to decrypt your spaces on this device.'}
          </p>
        </div>

        <form
          onSubmit={needsSetup ? handleSetup : forgotPin ? handleRecover : handleUnlock}
          className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-3"
        >
          {showPasskeyUnlock && (
            <>
              <button
                type="button"
                onClick={handlePasskeyUnlock}
                disabled={unlocking}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                <Fingerprint size={16} />
                {pendingAction === 'passkey' ? 'Waiting…' : 'Unlock with passkey'}
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-bg-border" />
                <span className="text-text-muted text-[10px] uppercase tracking-wide">or use PIN</span>
                <div className="h-px flex-1 bg-bg-border" />
              </div>
            </>
          )}

          {forgotPin && (
            <div>
              <label htmlFor="vault-recovery-code" className="block text-xs font-medium text-text-secondary mb-1.5">
                Recovery code
              </label>
              <input
                id="vault-recovery-code"
                type="text"
                value={recoveryCodeInput}
                onChange={e => { setRecoveryCodeInput(e.target.value); setFormError('') }}
                required
                autoComplete="off"
                inputMode="text"
                disabled={unlocking}
                className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm disabled:opacity-50"
              />
            </div>
          )}

          <PinInput
            id="vault-pin"
            label={needsSetup || forgotPin ? 'New vault PIN' : 'Vault PIN'}
            value={pin}
            onChange={v => { setPin(v); setFormError('') }}
            autoComplete={needsSetup || forgotPin ? 'new-password' : 'off'}
            disabled={unlocking}
          />

          {(needsSetup || forgotPin) && (
            <PinInput
              id="vault-pin-confirm"
              label="Confirm vault PIN"
              value={confirmPin}
              onChange={v => { setConfirmPin(v); setFormError('') }}
              autoComplete="new-password"
              disabled={unlocking}
            />
          )}

          <WeakPinWarning message={weakPinWarning} />

          {formError && (
            <p className="text-danger text-xs">{formError}</p>
          )}

          {unlockError && (
            <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {unlockError}
            </p>
          )}

          <button
            type="submit"
            disabled={unlocking}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            <Lock size={14} />
            {pendingAction === 'pin'
              ? 'Working…'
              : needsSetup
                ? 'Create PIN'
                : forgotPin
                  ? 'Reset PIN'
                : 'Unlock vault'}
          </button>

          {!needsSetup && !forgotPin && (
            <button
              type="button"
              onClick={() => { setForgotPin(true); resetFields(); clearUnlockError() }}
              className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Forgot PIN?
            </button>
          )}

          {forgotPin && (
            <button
              type="button"
              onClick={() => { setForgotPin(false); resetFields(); clearUnlockError() }}
              className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Back to PIN unlock
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 text-sm font-semibold text-text-secondary hover:text-danger transition-colors"
          >
            Sign out
          </button>
        </form>

        <p className="text-center text-text-muted text-[10px] mt-4 sm:mt-6 leading-relaxed">
          Vault PIN is separate from your login password.
        </p>
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need your login password and vault PIN to sign back in."
          confirmLabel="Sign out"
          destructive
          onConfirm={() => { setConfirmSignOut(false); signOut() }}
          onClose={() => setConfirmSignOut(false)}
        />
      )}
    </div>
  )
}
