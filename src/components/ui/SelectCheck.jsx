/**
 * SelectCheck.jsx - The select-mode check box at the end of a card or row
 * (spaces, items, Archive, Recycle bin): an empty rounded box that fills with
 * the accent when selected. Decorative - the card itself is the control.
 */
import { Check } from 'lucide-react'

export function SelectCheck({ selected, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
        selected ? 'bg-accent border-accent text-accent-fg' : 'border-bg-border text-transparent'
      } ${className}`}
    >
      <Check size={14} />
    </span>
  )
}
