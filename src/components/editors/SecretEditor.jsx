/**
 * Editor for the "secret" item type. The body is a nested ciphertext
 * ({ secret, cipher }) left sealed by normal item decryption, so the plaintext
 * never enters the query cache. Revealing or editing an existing secret requires
 * re-entering the vault PIN, and the reveal is transient (resets on unmount).
 * Reveal/Hide live in SpaceItem's action row, driving this via `onStateChange`
 * and the imperative `startReveal()` / `hide()` ref.
 */
import { useState, useRef, useEffect, useId, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Lock } from 'lucide-react'
import { useEncryption } from '../../context/EncryptionCore'
import { encryptString, decryptString } from '../../lib/crypto/cipher'
import PinInput from '../PinInput'

export const SecretEditor = forwardRef(function SecretEditor({ content, onChange, onStateChange }, ref) {
  const { cryptoKey, verifyVaultPin } = useEncryption()
  const cipher = content?.cipher || ''

  const [revealed, setRevealed] = useState(() => !cipher)
  const [text, setText] = useState('')
  const [prompting, setPrompting] = useState(false)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latestText = useRef('')
  const taRef = useRef(null)
  const pinId = useId()

  // Auto-grow the textarea to fit its content.
  const adjust = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => { if (revealed) adjust() }, [text, revealed])

  // Report state to the parent (it renders the Reveal / Hide buttons), and
  // reset it on unmount (item collapsed / left the page).
  useEffect(() => { onStateChange?.({ revealed, prompting }) }, [revealed, prompting, onStateChange])
  useEffect(() => () => onStateChange?.({ revealed: false, prompting: false }), [onStateChange])

  const startReveal = useCallback(() => setPrompting(true), [])
  const hide = useCallback(() => {
    setRevealed(false)
    setText('')
    latestText.current = ''
    setPin('')
    setError('')
  }, [])
  useImperativeHandle(ref, () => ({ startReveal, hide }), [startReveal, hide])

  const handleReveal = async (e) => {
    e?.preventDefault?.()
    if (busy || !pin) return
    setBusy(true)
    setError('')
    try {
      const ok = await verifyVaultPin(pin)
      if (!ok) {
        setError('Incorrect PIN.')
        return
      }
      const plain = cipher ? await decryptString(cipher, cryptoKey) : ''
      setText(plain)
      latestText.current = plain
      setRevealed(true)
      setPrompting(false)
      setPin('')
    } catch (err) {
      setError(err?.message || 'Could not reveal this secret.')
    } finally {
      setBusy(false)
    }
  }

  const handleTextChange = async (value) => {
    setText(value)
    latestText.current = value
    const nextCipher = value ? await encryptString(value, cryptoKey) : ''
    // Skip if a newer keystroke has superseded this one (encryption is async).
    if (latestText.current !== value) return
    onChange({ secret: true, cipher: nextCipher })
  }

  // ── Revealed / editing ──
  if (revealed) {
    return (
      <textarea
        ref={taRef}
        autoFocus
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        placeholder="Secret content…"
        rows={3}
        className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none overflow-hidden min-h-[80px] leading-relaxed font-mono"
      />
    )
  }

  // ── PIN prompt ──
  if (prompting) {
    return (
      <form onSubmit={handleReveal} className="space-y-2 rounded-xl border border-bg-border bg-bg-elevated p-3">
        <p className="text-xs text-text-muted">Enter your vault PIN to reveal this secret.</p>
        <PinInput id={pinId} value={pin} onChange={setPin} disabled={busy} autoComplete="off" />
        {error && <p className="text-danger text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !pin}
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-2 text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {busy ? 'Checking…' : 'Unlock'}
          </button>
          <button
            type="button"
            onClick={() => { setPrompting(false); setPin(''); setError('') }}
            className="rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  // ── Masked (locked) - reveal from the item's action row ──
  return (
    <div className="flex items-center gap-2 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3 text-sm text-text-muted">
      <Lock size={14} className="shrink-0" />
      <span className="truncate font-mono tracking-widest">••••••••••</span>
    </div>
  )
})
