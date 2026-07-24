/**
 * DrawEditor.jsx - Freehand drawing editor for the "draw" item type.
 *
 * Strokes are vectors ({ points: [[x, y, pressure], …], color, size }) captured
 * in a fixed logical space and rendered through an SVG viewBox, so a drawing
 * scales to any width and stays editable. The strokes JSON is encrypted like any
 * other item content; only a finished stroke (or undo/clear) triggers a save.
 */
import { useState, useRef, useMemo } from 'react'
import { Undo2, Eraser } from 'lucide-react'
import { strokeToSvgPath, DRAW_VIEW_W, DRAW_VIEW_H } from '../../lib/drawing'

// Ink colours chosen to read on the white canvas (and in PDF export).
const COLORS = ['#1e293b', '#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed']
const SIZES = [4, 8, 16]

export function DrawEditor({ content, onChange }) {
  const strokes = useMemo(() => content?.strokes || [], [content?.strokes])
  const [drawing, setDrawing] = useState(null) // in-progress { points, color, size }
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const svgRef = useRef(null)

  // Committed strokes don't change mid-draw, so keep their paths memoised.
  const committed = useMemo(
    () => strokes.map(s => ({ d: strokeToSvgPath(s.points, s.size), color: s.color })),
    [strokes]
  )

  const toPoint = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0, 0.5]
    const x = ((e.clientX - rect.left) / rect.width) * DRAW_VIEW_W
    const y = ((e.clientY - rect.top) / rect.height) * DRAW_VIEW_H
    return [x, y, e.pressure || 0.5]
  }

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrawing({ points: [toPoint(e)], color, size })
  }

  const handlePointerMove = (e) => {
    if (!drawing) return
    const point = toPoint(e)
    setDrawing(d => (d ? { ...d, points: [...d.points, point] } : d))
  }

  const handlePointerUp = () => {
    if (!drawing) return
    if (drawing.points.length > 0) {
      onChange({ strokes: [...strokes, drawing] })
    }
    setDrawing(null)
  }

  const undo = () => onChange({ strokes: strokes.slice(0, -1) })
  const clear = () => onChange({ strokes: [] })

  const hasStrokes = strokes.length > 0

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'border-accent scale-110' : 'border-bg-border'}`}
              style={{ backgroundColor: c }}
              aria-label={`Pen colour ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${size === s ? 'border-accent bg-accent-muted' : 'border-bg-border bg-bg-surface hover:bg-bg-elevated'}`}
              aria-label={`Pen size ${s}`}
              aria-pressed={size === s}
            >
              <span className="rounded-full bg-text-secondary" style={{ width: s / 2 + 3, height: s / 2 + 3 }} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!hasStrokes}
            className="flex h-7 items-center gap-1 rounded-lg border border-bg-border bg-bg-surface px-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-40"
          >
            <Undo2 size={13} /> Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!hasStrokes}
            className="flex h-7 items-center gap-1 rounded-lg border border-bg-border bg-bg-surface px-2 text-xs font-medium text-text-secondary hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-40"
          >
            <Eraser size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${DRAW_VIEW_W} ${DRAW_VIEW_H}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full touch-none rounded-xl border border-bg-border bg-white cursor-crosshair"
        style={{ aspectRatio: `${DRAW_VIEW_W} / ${DRAW_VIEW_H}` }}
      >
        {committed.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} />
        ))}
        {drawing && <path d={strokeToSvgPath(drawing.points, drawing.size)} fill={drawing.color} />}
      </svg>
    </div>
  )
}
