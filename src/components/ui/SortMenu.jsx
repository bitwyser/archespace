/**
 * SortMenu.jsx - Compact dropdown for choosing a list sort order.
 *
 * Shows the active option's label and a small popover of the choices with a
 * check on the current one. Closes on outside click or Escape.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'
import { SORT_OPTIONS } from '../../lib/sortEntities'
import { buttonClass } from './buttonStyles'

export function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const active = SORT_OPTIONS.find(o => o.id === value) || SORT_OPTIONS[0]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={buttonClass({
          variant: 'ghost',
          size: 'sm',
          className: `max-sm:w-8 max-sm:px-0 ${open ? '!bg-accent-muted !text-accent' : ''}`,
        })}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Sort"
      >
        <ArrowUpDown size={14} />
        <span className="max-sm:hidden">{active.label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-30 min-w-[10rem] rounded-xl border border-bg-border bg-bg-surface p-1.5 shadow-2xl shadow-black/30 animate-fade-in"
        >
          <p className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">Sort by</p>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={opt.id === value}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                opt.id === value
                  ? 'text-accent bg-accent-muted'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.id === value && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
