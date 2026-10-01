/**
 * ViewToggle.jsx - Grid / list switch: a soft segmented control (no border),
 * the active side raised on the surface colour.
 */
import { LayoutGrid, List } from 'lucide-react'

const OPTIONS = [
  { id: 'grid', label: 'Grid view', icon: LayoutGrid },
  { id: 'list', label: 'List view', icon: List },
]

export function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg bg-bg-elevated p-0.5" role="group" aria-label="View">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={label}
          aria-pressed={value === id}
          title={label}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            value === id
              ? 'bg-bg-surface text-accent shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}
