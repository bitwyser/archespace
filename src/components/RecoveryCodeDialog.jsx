/**
 * RecoveryCodeDialog.jsx - One-time recovery code shown in a popup, with copy
 * and an explicit "I've saved it" confirmation. Used after vault setup / PIN
 * reset and from Settings.
 *
 * The code is shown only once and losing it makes a forgotten PIN unrecoverable,
 * so dismissal (button, close, backdrop, or Escape) only finalizes once the user
 * has ticked the confirmation - an accidental Escape/backdrop can't skip it.
 */
import { useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import { Modal } from './ui/UI'

export default function RecoveryCodeDialog({
  code,
  title = 'Save your recovery code',
  description = "Store this somewhere safe. It's shown only once - without it, a forgotten vault PIN leaves your data unrecoverable.",
  acknowledgeLabel = 'I saved this code',
  onAcknowledge,
  busy = false,
}) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable - the code is still shown for manual copying.
    }
  }

  // Only finalize once the user has confirmed they saved the code, so an
  // accidental backdrop click or Escape can't dismiss this one-time code (and
  // silently unlock the vault) before it is written down.
  const finish = () => {
    if (confirmed && !busy) onAcknowledge()
  }

  return (
    <Modal title={title} onClose={finish}>
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2.5 text-xs leading-relaxed text-amber-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {description}
        </p>

        <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 space-y-3">
          <p className="text-center font-mono text-xl tracking-[0.2em] text-text-primary break-all">
            {code}
          </p>
          <button
            type="button"
            onClick={copy}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-bg-border bg-bg-surface py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all"
          >
            {copied ? (
              <>
                <Check size={15} className="text-success" /> Copied
              </>
            ) : (
              <>
                <Copy size={15} /> Copy code
              </>
            )}
          </button>
        </div>

        <label className="flex cursor-pointer select-none items-start gap-2.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-bg-border bg-bg-elevated accent-accent"
          />
          I&apos;ve saved my recovery code somewhere safe.
        </label>

        <button
          type="button"
          onClick={finish}
          disabled={busy || !confirmed}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-[#0c1a16] rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {acknowledgeLabel}
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {copied ? 'Recovery code copied to clipboard' : ''}
      </span>
    </Modal>
  )
}
