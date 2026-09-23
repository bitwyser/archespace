/**
 * WordmarkLogo.jsx - The horizontal ArcheSpace wordmark. "Arche" uses
 * fill="currentColor" so it follows the theme accent via a text-* class;
 * "Space" is always white (the wordmark is shown on dark surfaces in-app).
 * Size it with a className, e.g. `h-8 w-auto`.
 */
import { ARCHE_PATH, SPACE_PATH, WORDMARK_VIEWBOX } from '../lib/brandPaths'

export function WordmarkLogo({ className = '' }) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={className}
      role="img"
      aria-label="ArcheSpace logo"
    >
      <path d={ARCHE_PATH} fill="currentColor" fillRule="evenodd" />
      <path d={SPACE_PATH} fill="#ffffff" fillRule="evenodd" />
    </svg>
  )
}
