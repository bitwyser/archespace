/**
 * AuthenticatorEditor.jsx - Editor for the "authenticator" item type: a list of
 * TOTP accounts that render live rotating codes. Secrets are kept in the item's
 * encrypted content, so they are stored zero-knowledge like any vault data.
 */
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import { generateTotp, secondsRemaining, parseOtpauthUri, isValidTotpSecret } from '../../lib/crypto/totp'

function formatCode(code) {
  if (!code) return '------'
  const mid = Math.ceil(code.length / 2)
  return `${code.slice(0, mid)} ${code.slice(mid)}`
}

export function AuthenticatorEditor({ content, onChange, readOnly = false }) {
  const entries = useMemo(() => content?.entries || [], [content])

  const [codes, setCodes] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const [copiedId, setCopiedId] = useState(null)
  const [adding, setAdding] = useState(entries.length === 0 && !readOnly)
  const [form, setForm] = useState({ issuer: '', label: '', secret: '' })
  const [formError, setFormError] = useState('')

  // Tick every second for the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Recompute codes whenever the entries or the current second change. Cheap for
  // the handful of accounts a person keeps, and always correct across rollovers.
  const entriesKey = useMemo(
    () => entries.map(e => `${e.id}:${e.secret}:${e.digits}:${e.period}:${e.algorithm}`).join('|'),
    [entries]
  )
  const secondBucket = Math.floor(now / 1000)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = {}
      for (const e of entries) {
        next[e.id] = await generateTotp(e.secret, e)
      }
      if (!cancelled) setCodes(next)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesKey, secondBucket])

  const commit = (nextEntries) => onChange({ entries: nextEntries })

  const addEntry = () => {
    setFormError('')
    // Allow pasting a full otpauth:// URI into the secret field.
    const pasted = parseOtpauthUri(form.secret)
    const entry = pasted || {
      issuer: form.issuer.trim(),
      label: form.label.trim(),
      secret: form.secret.replace(/\s+/g, ''),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    }
    if (!isValidTotpSecret(entry.secret)) {
      setFormError('Enter a valid Base32 secret or an otpauth:// link.')
      return
    }
    if (pasted) {
      // Prefer any issuer/label the user typed over the URI's own.
      if (form.issuer.trim()) entry.issuer = form.issuer.trim()
      if (form.label.trim()) entry.label = form.label.trim()
    }
    entry.id = crypto.randomUUID()
    commit([...entries, entry])
    setForm({ issuer: '', label: '', secret: '' })
    setFormError('')
    setAdding(false)
  }

  const removeEntry = (id) => commit(entries.filter(e => e.id !== id))

  const copyCode = async (id) => {
    const code = codes[id]
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(cur => (cur === id ? null : cur)), 1500)
    } catch {
      // Clipboard unavailable.
    }
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && !adding && (
        <p className="text-text-muted text-sm italic">{readOnly ? 'No accounts.' : 'No accounts yet. Add one to generate codes.'}</p>
      )}

      {entries.map((entry) => {
        const remaining = secondsRemaining(entry.period || 30, now)
        const pct = (remaining / (entry.period || 30)) * 100
        const low = remaining <= 5
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {entry.issuer || entry.label || 'Account'}
              </p>
              {entry.issuer && entry.label && (
                <p className="truncate text-xs text-text-muted">{entry.label}</p>
              )}
              <p className="mt-1 font-mono text-2xl tracking-[0.18em] text-text-primary tabular-nums">
                {formatCode(codes[entry.id])}
              </p>
              <div className="mt-1.5 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-bg-border">
                <div
                  className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${low ? 'bg-danger' : 'bg-accent'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <span
              className={`w-6 shrink-0 text-center text-xs font-semibold tabular-nums ${low ? 'text-danger' : 'text-text-muted'}`}
              title={`${remaining}s until the code refreshes`}
            >
              {remaining}s
            </span>

            <button
              type="button"
              onClick={() => copyCode(entry.id)}
              aria-label={copiedId === entry.id ? 'Copied' : 'Copy code'}
              title={copiedId === entry.id ? 'Copied' : 'Copy code'}
              className={`shrink-0 p-2 rounded-lg border transition-all ${
                copiedId === entry.id
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              {copiedId === entry.id ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {!readOnly && (
            <button
              type="button"
              onClick={() => removeEntry(entry.id)}
              aria-label="Remove account"
              title="Remove account"
              className="shrink-0 p-2 rounded-lg border border-bg-border bg-bg-surface text-text-secondary hover:text-danger hover:border-danger/30 transition-all"
            >
              <Trash2 size={14} />
            </button>
            )}
          </div>
        )
      })}

      {readOnly ? null : adding ? (
        <div className="rounded-xl border border-bg-border bg-bg-elevated p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.issuer}
              onChange={e => { setForm(f => ({ ...f, issuer: e.target.value })); setFormError('') }}
              placeholder="Issuer (e.g. GitHub)"
              className="bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
            <input
              value={form.label}
              onChange={e => { setForm(f => ({ ...f, label: e.target.value })); setFormError('') }}
              placeholder="Account (e.g. you@email)"
              className="bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <input
            value={form.secret}
            onChange={e => { setForm(f => ({ ...f, secret: e.target.value })); setFormError('') }}
            placeholder="Secret key, or paste an otpauth:// link"
            autoComplete="off"
            spellCheck={false}
            className="password-field w-full bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          {formError && <p className="text-danger text-xs">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addEntry}
              className="rounded-lg bg-accent hover:bg-accent-hover text-accent-fg px-3 py-2 text-xs font-semibold transition-colors"
            >
              Add account
            </button>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => { setAdding(false); setForm({ issuer: '', label: '', secret: '' }); setFormError('') }}
                className="rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-bg-border rounded-xl text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all text-sm font-medium"
        >
          <Plus size={16} /> Add account
        </button>
      )}
    </div>
  )
}
