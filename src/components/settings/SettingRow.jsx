/**
 * SettingRow.jsx - Building blocks for the settings page.
 *
 * Every setting is one row: a title and a short explanation (with its current
 * state) on the left, a single action on the right. A row's form stays hidden
 * until its action opens it, so the page reads as a list of settings rather
 * than a wall of fields. Rows sit in labelled groups.
 */

/** Secondary action button used on the right of a row. */
export const rowButtonClass =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-bg-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'

/** Destructive variant of the row action. */
export const rowDangerButtonClass =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-bg-border bg-bg-surface px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-muted disabled:cursor-not-allowed disabled:opacity-50'

/** Primary submit button inside an opened row form. */
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50'

/** Text input inside a row form. */
export const inputClass =
  'w-full rounded-xl border border-bg-border bg-bg-elevated px-4 py-3 text-sm text-text-primary focus:border-accent focus:outline-none'

export const labelClass = 'mb-1.5 block text-xs font-medium text-text-secondary'

/**
 * @param {{ title: string, description?: React.ReactNode, action?: React.ReactNode, open?: boolean, children?: React.ReactNode }} props
 *   `children` is the row's form, shown only while `open`.
 */
export function SettingRow({ title, description, action, open = false, children }) {
  return (
    <div className="px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && (
            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</div>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {open && children && (
        <div className="mt-4 rounded-xl bg-bg-sunken p-4">{children}</div>
      )}
    </div>
  )
}

/** A labelled group of rows in one bordered list. */
export function SettingGroup({ label, danger = false, children }) {
  return (
    <div className="mb-6 last:mb-0">
      {label && (
        <h3 className={`mb-2 px-1 text-xs font-semibold uppercase tracking-wide ${danger ? 'text-danger' : 'text-text-muted'}`}>
          {label}
        </h3>
      )}
      <div className="divide-y divide-bg-border overflow-hidden rounded-xl border border-bg-border bg-bg-surface">
        {children}
      </div>
    </div>
  )
}

/** Cancel + submit footer for a row form. */
export function FormActions({ onCancel, submitLabel, busy, busyLabel, disabled = false }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className={rowButtonClass}>
        Cancel
      </button>
      <button type="submit" disabled={busy || disabled} className={primaryButtonClass}>
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  )
}
