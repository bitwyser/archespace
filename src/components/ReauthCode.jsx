/**
 * ReauthCode.jsx - "Enter the 6-digit code we emailed you" step.
 *
 * Shared by the password-change and email-change reauthentication flows.
 * The code is the reauthentication OTP Supabase sends to the current email.
 */
import { useState } from 'react'

export default function ReauthCode({ email, onConfirm, onCancel, onResend, busy }) {
  const [code, setCode] = useState('')

  return (
    <div className="mt-3 space-y-3">
      <p className="text-text-muted text-xs leading-relaxed">
        Enter the 6-digit code we emailed to{' '}
        <span className="text-text-secondary">{email}</span> to confirm it's you.
      </p>
      <input
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        aria-label="Verification code"
        className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-center text-sm tracking-[0.4em] font-mono focus:outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || code.length < 6}
          onClick={() => onConfirm(code)}
          className="flex-1 bg-accent hover:bg-accent-hover text-accent-fg rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Confirming…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 rounded-xl border border-bg-border bg-bg-elevated text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
      {onResend && (
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      )}
    </div>
  )
}
