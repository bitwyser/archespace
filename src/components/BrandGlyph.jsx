/**
 * BrandGlyph.jsx - The ArcheSpace "A" mark as an inline SVG. Uses
 * `fill="currentColor"` so it takes the surrounding text colour (accent via a
 * text-* class, or the landing page's pastel). Size it with a className, e.g.
 * `h-[80%] w-[80%]`.
 */
import { A_PATH, GLYPH_VIEWBOX } from '../lib/brandPaths'

export function BrandGlyph({ className = '' }) {
  return (
    <svg
      viewBox={GLYPH_VIEWBOX}
      className={className}
      fill="currentColor"
      role="img"
      aria-label="ArcheSpace logo"
    >
      <path d={A_PATH} fillRule="evenodd" />
    </svg>
  )
}
