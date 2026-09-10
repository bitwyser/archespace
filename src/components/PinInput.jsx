/**
 * PinInput.jsx - Vault secret field: a numeric PIN or an alphanumeric
 * passphrase (letters, numbers, symbols). Includes a show/hide toggle so the
 * user can check what they typed (a hidden secret is easy to mistype).
 */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { VAULT_PIN_MAX_LENGTH } from '../lib/constants'

export default function PinInput({
  id,
  label,
  value,
  onChange,
  autoComplete = 'off',
  disabled = false,
  autoFocus = false,
  className = '',
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          inputMode="text"
          maxLength={VAULT_PIN_MAX_LENGTH}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-sm font-mono focus:outline-none focus:border-accent disabled:opacity-50 ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          tabIndex={-1}
          aria-label={show ? 'Hide PIN' : 'Show PIN'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
