/**
 * PasskeyManager.jsx - Enroll and remove biometric (WebAuthn PRF) passkeys
 * that unlock the vault. Lives in Settings → Security.
 */
import { useState } from 'react'
import { Fingerprint, Trash2 } from 'lucide-react'
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
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (pin.length < VAULT_PIN_MIN_LENGTH) {
      toast.error('Enter your current vault PIN to add a passkey.')
      return
    }
    setAdding(true)
    try {
      await enrollPasskey(pin, label)
      setPin('')
      setLabel('')
      toast.success('Passkey added. You can now unlock with biometrics.')
    } catch (err) {
      toast.error(err?.message || "Couldn't add passkey.")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async () => {
    if (!confirmRemove) return
    const id = confirmRemove.id
    setRemovingId(id)
    try {
      await removePasskey(id)
      setConfirmRemove(null)
      toast.success('Passkey removed.')
    } catch (err) {
      toast.error(err?.message || "Couldn't remove passkey.")
    } finally {
      setRemovingId('')
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">Passkey / biometric unlock</h3>
      <p className="text-text-muted text-xs mt-0.5">
        Unlock your vault with Face ID, Touch ID, or Windows Hello instead of typing your PIN.
        Your PIN and recovery code still work as backups.
      </p>

      {!passkeySupported ? (
        <p className="text-text-muted text-xs mt-3 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
          Biometric unlock isn’t available on this device or browser.
        </p>
      ) : !vaultStatus.hasVault ? (
        <p className="text-text-muted text-xs mt-3 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
          Create a vault PIN first, then you can add a passkey.
        </p>
      ) : (
        <>
          {passkeys.length > 0 && (
            <ul className="mt-3 space-y-2">
              {passkeys.map((pk) => {
                const created = formatDate(pk.createdAt)
                const lastUsed = formatDate(pk.lastUsedAt)
                return (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between gap-3 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {pk.label || 'Passkey'}
                      </p>
                      <p className="text-text-muted text-[11px] mt-0.5">
                        {created ? `Added ${created}` : 'Added'}
                        {lastUsed ? ` · Last used ${lastUsed}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(pk)}
                      disabled={removingId === pk.id}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bg-border text-text-secondary hover:text-danger hover:border-danger/30 hover:bg-danger/10 text-xs font-medium transition-colors disabled:opacity-50"
                      aria-label={`Remove ${pk.label || 'passkey'}`}
                    >
                      <Trash2 size={14} />
                      {removingId === pk.id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={handleAdd} className="mt-3 space-y-3">
            <div>
              <label htmlFor="passkey-label" className="block text-xs font-medium text-text-secondary mb-1.5">
                Passkey name (optional)
              </label>
              <input
                id="passkey-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. MacBook Touch ID"
                maxLength={80}
                autoComplete="off"
                disabled={adding || unlocking}
                className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
              />
            </div>
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
              {adding ? 'Waiting for device…' : 'Add passkey'}
            </button>
          </form>
        </>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove this passkey?"
          message={`"${confirmRemove.label || 'Passkey'}" will no longer unlock your vault. You can still unlock with your PIN, and re-add a passkey later.`}
          confirmLabel="Remove"
          destructive
          busy={removingId === confirmRemove.id}
          onConfirm={handleRemove}
          onClose={() => setConfirmRemove(null)}
        />
      )}
    </div>
  )
}
