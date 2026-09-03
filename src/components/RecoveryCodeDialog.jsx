/**
 * RecoveryCodeDialog.jsx - One-time recovery code shown in a popup, with copy
 * and acknowledgement. Used after vault setup / PIN reset and from Settings.
 *
 * Dismissing the dialog (button, close, backdrop, or Escape) calls onAcknowledge,
 * so callers can safely finalize (e.g. unlock the vault) on any dismissal.
 */
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Modal } from './ui/UI'

export default function RecoveryCodeDialog({
  code,
  title = 'Save your recovery code',
  description = 'This code is shown once. Use it to reset your vault PIN if you forget it.',
  acknowledgeLabel = 'I saved this code',
  onAcknowledge,
  busy = false,
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable - the code is still shown for manual copying.
    }
  }

  return (
    <Modal title={title} onClose={onAcknowledge}>
      <div className="space-y-4">
        <p className="text-text-muted text-sm leading-relaxed">{description}</p>

        <div className="flex items-center gap-2 rounded-xl border border-bg-border bg-bg-elevated p-4">
          <p className="flex-1 font-mono text-xl tracking-[0.2em] text-text-primary break-all">{code}</p>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy recovery code'}
            title={copied ? 'Copied' : 'Copy'}
            className="shrink-0 p-2 rounded-lg border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all"
          >
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          </button>
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {acknowledgeLabel}
        </button>
      </div>
    </Modal>
  )
}
