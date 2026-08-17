/**
 * DrawEditor.jsx - Drawing editor for the "draw" item type.
 *
 * Strokes are vectors ({ points: [[x, y, pressure], …], color, size }) captured
 * in a fixed logical space and rendered through an SVG viewBox, so a drawing
 * scales to any width and stays editable. Shape tools (line/rect/ellipse) trace
 * the same point format, so they save and render like any freehand stroke. The
 * canvas orientation (landscape/portrait) is saved alongside the strokes.
 */
import { useState, useRef, useMemo } from 'react'
import {
  Undo2, Eraser, Pencil, Minus, Square, Circle,
  RectangleHorizontal, RectangleVertical,
} from 'lucide-react'
import { strokeToSvgPath, drawDims, shapePoints } from '../../lib/drawing'

// Ink colours chosen to read on the white canvas (and in PDF export).
const COLORS = ['#1e293b', '#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed']
const SIZES = [4, 8, 16]
const TOOLS = [
  { id: 'pen', icon: Pencil, label: 'Pen' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
]

export function DrawEditor({ content, onChange }) {
  const strokes = useMemo(() => content?.strokes || [], [content?.strokes])
  const orientation = content?.orientation === 'portrait' ? 'portrait' : 'landscape'
  const { w: viewW, h: viewH } = drawDims(orientation)

  const [drawing, setDrawing] = useState(null) // in-progress { points, color, size }
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [tool, setTool] = useState('pen')
  const svgRef = useRef(null)
  const startRef = useRef(null)

  // Committed strokes don't change mid-draw, so keep their paths memoised.
  const committed = useMemo(
    () => strokes.map(s => ({ d: strokeToSvgPath(s.points, s.size), color: s.color })),
    [strokes]
  )

  const save = (nextStrokes) => onChange({ strokes: nextStrokes, orientation })

  const toPoint = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0, 0.5]
    const x = ((e.clientX - rect.left) / rect.width) * viewW
    const y = ((e.clientY - rect.top) / rect.height) * viewH
    return [x, y, e.pressure || 0.5]
  }

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = toPoint(e)
    startRef.current = p
    setDrawing({ points: [p], color, size })
  }

  const handlePointerMove = (e) => {
    if (!drawing) return
    const p = toPoint(e)
    if (tool === 'pen') {
      setDrawing(d => (d ? { ...d, points: [...d.points, p] } : d))
    } else {
      const pts = shapePoints(tool, startRef.current, p)
      setDrawing(d => (d ? { ...d, points: pts } : d))
    }
  }

  const handlePointerUp = () => {
    if (!drawing) return
    if (drawing.points.length > 1) save([...strokes, drawing])
    setDrawing(null)
    startRef.current = null
  }

  const setOrientation = (next) => {
    if (next === orientation) return
    onChange({ strokes, orientation: next })
  }

  const undo = () => save(strokes.slice(0, -1))
  const clear = () => save([])
  const hasStrokes = strokes.length > 0

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              title={label}
              aria-label={label}
              aria-pressed={tool === id}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${tool === id ? 'border-accent bg-accent-muted text-accent' : 'border-bg-border bg-bg-surface text-text-secondary hover:bg-bg-elevated'}`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
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
            onClick={() => setOrientation('landscape')}
            title="Landscape"
            aria-label="Landscape canvas"
            aria-pressed={orientation === 'landscape'}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${orientation === 'landscape' ? 'border-accent bg-accent-muted text-accent' : 'border-bg-border bg-bg-surface text-text-secondary hover:bg-bg-elevated'}`}
          >
            <RectangleHorizontal size={15} />
          </button>
          <button
            type="button"
            onClick={() => setOrientation('portrait')}
            title="Portrait"
            aria-label="Portrait canvas"
            aria-pressed={orientation === 'portrait'}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${orientation === 'portrait' ? 'border-accent bg-accent-muted text-accent' : 'border-bg-border bg-bg-surface text-text-secondary hover:bg-bg-elevated'}`}
          >
            <RectangleVertical size={15} />
          </button>
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
        viewBox={`0 0 ${viewW} ${viewH}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="mx-auto block w-full touch-none rounded-xl border border-bg-border bg-white cursor-crosshair"
        style={{ aspectRatio: `${viewW} / ${viewH}`, maxWidth: orientation === 'portrait' ? 420 : '100%' }}
      >
        {committed.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} />
        ))}
        {drawing && <path d={strokeToSvgPath(drawing.points, drawing.size)} fill={drawing.color} />}
      </svg>
    </div>
  )
}
