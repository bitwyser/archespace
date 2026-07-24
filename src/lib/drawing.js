/**
 * drawing.js - Shared helpers for the freehand "draw" item type.
 *
 * Strokes are stored as vector points in a fixed logical coordinate space
 * (DRAW_VIEW_W x DRAW_VIEW_H) and rendered through an SVG viewBox, so a drawing
 * scales cleanly to any width. `perfect-freehand` turns the points into a
 * smooth filled outline; the same code runs in the editor and in PDF export.
 */
import { getStroke } from 'perfect-freehand'

export const DRAW_VIEW_W = 1000
export const DRAW_VIEW_H = 600

const STROKE_OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.5 }

/** Turn recorded points ([x, y, pressure]) into an SVG path string. */
export function strokeToSvgPath(points, size = 8) {
  const outline = getStroke(points || [], { size, ...STROKE_OPTIONS })
  if (!outline.length) return ''
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...outline[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}
