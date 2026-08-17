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

/** Logical canvas size for the saved orientation ('portrait' swaps W/H). */
export function drawDims(orientation) {
  return orientation === 'portrait'
    ? { w: DRAW_VIEW_H, h: DRAW_VIEW_W }
    : { w: DRAW_VIEW_W, h: DRAW_VIEW_H }
}

/**
 * Trace a shape (line / rect / ellipse) from start to end as a dense point
 * list, so it saves and renders as an ordinary stroke on every platform.
 */
export function shapePoints(tool, [x0, y0], [x1, y1]) {
  const P = 0.5
  const lerp = (a, b, t) => a + (b - a) * t
  if (tool === 'line') {
    return Array.from({ length: 17 }, (_, i) => {
      const t = i / 16
      return [lerp(x0, x1, t), lerp(y0, y1, t), P]
    })
  }
  if (tool === 'rect') {
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
    const pts = []
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e]
      const [bx, by] = corners[e + 1]
      for (let i = 0; i < 12; i++) {
        const t = i / 12
        pts.push([lerp(ax, bx, t), lerp(ay, by, t), P])
      }
    }
    pts.push([x0, y0, P])
    return pts
  }
  if (tool === 'ellipse') {
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const rx = Math.abs(x1 - x0) / 2
    const ry = Math.abs(y1 - y0) / 2
    return Array.from({ length: 49 }, (_, i) => {
      const a = (i / 48) * 2 * Math.PI
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a), P]
    })
  }
  return []
}

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
