/**
 * BulkSelectionBar.jsx - Floating toolbar for bulk actions on selected rows.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * @param {{
 *   count: number,
 *   onClear: Function,
 *   actions: Array<{ id: string, label: string, icon: React.ComponentType, onClick: Function, variant?: 'danger' }>,
 * }} props
 */
export default function BulkSelectionBar({ count, onClear, actions }) {
  const barRef = useRef(null)

  // While the bar is visible, publish a marker + its measured height so the
  // toast stack can lift above it instead of overlapping it (see index.css).
  useEffect(() => {
    if (count === 0) return
    const el = barRef.current
    document.body.classList.add('bulk-bar-active')
    const publishHeight = () => {
      if (el) document.body.style.setProperty('--bulk-bar-height', `${el.offsetHeight}px`)
    }
    publishHeight()
    const observer = new ResizeObserver(publishHeight)
    if (el) observer.observe(el)
    return () => {
      observer.disconnect()
      document.body.classList.remove('bulk-bar-active')
      document.body.style.removeProperty('--bulk-bar-height')
    }
  }, [count])

  if (count === 0) return null

  return (
    <div ref={barRef} className="sticky bottom-4 z-30 mx-auto w-fit max-w-[calc(100%-1rem)]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl border border-accent/30 bg-bg-surface shadow-2xl shadow-black/20 backdrop-blur-md">
        <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
          {count} selected
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map(({ id, label, icon: Icon, onClick, variant }) => (
            <button
              key={id}
              type="button"
              onClick={onClick}
              title={label}
              aria-label={label}
              className={`p-2 rounded-lg border text-sm transition-all ${
                variant === 'danger'
                  ? 'border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-text-secondary'
                  : 'border-bg-border bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Clear selection"
          aria-label="Clear selection"
          className="p-2 rounded-lg border border-bg-border hover:bg-bg-elevated text-text-muted"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

