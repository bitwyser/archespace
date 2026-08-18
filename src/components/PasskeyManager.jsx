/**
 * PasskeyManager.jsx - Enable or remove biometric (WebAuthn PRF) unlock for the
 * vault. One passkey per browser (stored locally in IndexedDB). Lives in
 * Settings → Security.
 */
import { useState } from 'react'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { useEncryption } from '../context/EncryptionCore'
import { useToast } from '../context/ToastCore'
import PinInput from './PinInput'
import { ConfirmDialog } from './ui/UI'
import { VAULT_PIN_MIN_LENGTH } from '../lib/constants'

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export default function PasskeyManager() {
  const {
    passkeySupported,
    passkeys,
    enrollPasskey,
    removePasskey,
    vaultStatus,
    unlocking,
  } = useEncryption()
  const { toast } = useToast()

  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const passkey = passkeys[0] || null

  const handleEnable = async (e) => {
    e.preventDefault()
    if (pin.length < VAULT_PIN_MIN_LENGTH) {
      toast.error('Enter your current vault PIN to enable biometric unlock.')
      return
    }
    setAdding(true)
    try {
      await enrollPasskey(pin)
      setPin('')
      toast.success('Biometric unlock enabled.')
    } catch (err) {
      toast.error(err?.message || "Couldn't enable biometric unlock.")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async () => {
    if (!passkey) return
    setRemoving(true)
    try {
      await removePasskey(passkey.id)
      setConfirmRemove(false)
      toast.success('Biometric unlock disabled.')
    } catch (err) {
      toast.error(err?.message || "Couldn't disable biometric unlock.")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">Passkey / biometric unlock</h3>
      <p className="text-text-muted text-xs mt-0.5">
        Unlock your vault with Face ID, Touch ID, or Windows Hello instead of typing your PIN,
        on this browser. Your PIN and recovery code still work as backups.
      </p>

      {!passkeySupported ? (
        <p className="text-text-muted text-xs mt-3 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
          Biometric unlock isn’t available on this device or browser.
        </p>
      ) : !vaultStatus.hasVault ? (
        <p className="text-text-muted text-xs mt-3 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
          Create a vault PIN first, then you can enable biometric unlock.
        </p>
      ) : passkey ? (
        <div className="mt-3 flex items-center justify-between gap-3 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={16} className="text-success shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-text-primary">Biometric unlock is on</p>
              {formatDate(passkey.createdAt) && (
                <p className="text-text-muted text-[11px] mt-0.5">Enabled {formatDate(passkey.createdAt)}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            className="shrink-0 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-text-secondary text-sm font-medium transition-colors disabled:opacity-50"
          >
            Disable
          </button>
        </div>
      ) : (
        <form onSubmit={handleEnable} className="mt-3 space-y-3">
          <PinInput
            id="passkey-current-pin"
            label="Current vault PIN"
            value={pin}
            onChange={setPin}
            disabled={adding || unlocking}
          />
          <button
            type="submit"
            disabled={adding || unlocking || pin.length < VAULT_PIN_MIN_LENGTH}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            <Fingerprint size={16} />
            {adding ? 'Waiting for device…' : 'Enable biometric unlock'}
          </button>
        </form>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Disable biometric unlock?"
          message="This browser will no longer unlock with biometrics. You can still unlock with your PIN, and re-enable it later."
          confirmLabel="Disable"
          destructive
          busy={removing}
          onConfirm={handleRemove}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}
