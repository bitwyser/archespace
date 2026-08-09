/**
 * ItemEditors.jsx - Content editors for each space-item type.
 *
 * Exports five editor components, one per item type:
 *   - TextboxEditor    - Free-form plain text area (Note)
 *   - MarkdownEditor   - Markdown with click-to-edit / blur-to-preview
 *   - ChecklistEditor  - Checkbox items (add / check / remove)
 *   - MenuListEditor   - Simple bullet list
 *   - NumberedListEditor - Ordered list with auto numbering
 *   - CardListEditor   - Title + description card pairs
 *
 * Each editor receives the current `content` object and an
 * `onChange(newContent)` callback. They manage their own local
 * state and push changes up on every keystroke so the parent
 * can track dirty state and auto-save.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, CheckSquare, Square, GripVertical, Pencil } from 'lucide-react'
import MarkdownPreview from './MarkdownPreview'

// ─────────────────────────────────────────────────────────
// Shared delete button (shown on hover)
// ─────────────────────────────────────────────────────────

/** Small icon-only delete button, visible only when the row is hovered */
function DelBtn({ onClick, label = 'Delete item' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all shrink-0"
    >
      <Trash2 size={14} />
    </button>
  )
}

function ReorderBtn({ onDragStart, onDragEnd, onKeyDown }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      title="Drag to reorder. Use Arrow Up or Arrow Down while focused."
      aria-label="Reorder item"
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent-muted transition-all shrink-0"
    >
      <GripVertical size={14} />
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// TextboxEditor (Note) - Plain text only, no markdown
// ─────────────────────────────────────────────────────────

/**
 * Auto-expanding textarea for free-form plain text note content.
 * No markdown support - just simple text editing.
 *
 * @param {{ content: { text: string }, onChange: Function }} props
 */
export function TextboxEditor({ content, onChange }) {
  const [text, setText] = useState(content?.text || '')
  const ref = useRef(null)

  const adjust = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Auto-resize whenever text changes
  useEffect(() => { adjust() }, [text])

  const handleChange = (e) => {
    const nextText = e.target.value
    setText(nextText)
    onChange({ text: nextText })
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={text}
        onChange={handleChange}
        placeholder="Start writing anything…"
        rows={3}
        className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none overflow-hidden leading-relaxed min-h-[80px]"
      />
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// MarkdownEditor - Click-to-edit / blur-to-preview
// ─────────────────────────────────────────────────────────

/**
 * Markdown editor with two modes:
 *   - Preview mode (default): renders formatted markdown; click to edit
 *   - Edit mode: raw textarea; blur (click outside) returns to preview
 *
 * @param {{ content: { text: string }, onChange: Function }} props
 */
export function MarkdownEditor({ content, onChange }) {
  const [text, setText] = useState(content?.text || '')
  const [editing, setEditing] = useState(false)
  const ref = useRef(null)

  const adjust = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Auto-resize whenever text changes or we enter edit mode
  useEffect(() => {
    if (editing) adjust()
  }, [text, editing])

  const handleChange = (e) => {
    const nextText = e.target.value
    setText(nextText)
    onChange({ text: nextText })
  }

  const enterEditMode = useCallback(() => {
    setEditing(true)
    // Focus the textarea after it renders
    setTimeout(() => ref.current?.focus(), 0)
  }, [])

  const exitEditMode = useCallback(() => {
    setEditing(false)
  }, [])

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex justify-end">
          <span className="text-xs text-text-muted px-2 py-0.5 rounded-md bg-bg-elevated border border-bg-border">
            Editing — click outside to preview
          </span>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={handleChange}
          onBlur={exitEditMode}
          placeholder="Write markdown here…"
          rows={3}
          className="w-full bg-bg-elevated border border-accent/50 rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none overflow-hidden leading-relaxed min-h-[80px] font-mono"
        />
      </div>
    )
  }

  // Preview mode
  return (
    <div
      onClick={enterEditMode}
      className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm text-text-primary leading-relaxed min-h-[80px] prose-custom cursor-text hover:border-accent/30 transition-colors group/md"
      title="Click to edit"
    >
      {text ? (
        <>
          <MarkdownPreview text={text} />
          <div className="flex justify-end mt-2 opacity-0 group-hover/md:opacity-100 transition-opacity">
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Pencil size={14} />
              Click to edit
            </span>
          </div>
        </>
      ) : (
        <span className="text-text-muted italic">Click to start writing markdown…</span>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// ListEditor (shared by ChecklistEditor & MenuListEditor)
// ─────────────────────────────────────────────────────────

function ListEditor({ content, onChange, variant }) {
  const isChecklist = variant === 'checkbox'
  const isNumbered = variant === 'numbered'
  const inputAttr = isChecklist ? 'data-checklist-input' : 'data-menu-input'
  const [items, setItems] = useState(content?.items || [])
  const containerRef = useRef(null)
  const dragFromIndex = useRef(null)

  const adjustItemText = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Resize every textarea only when rows are added/removed. Edits resize their
  // own textarea inline (below), so there's no need to sweep the whole list —
  // via querySelectorAll — on every keystroke.
  useEffect(() => {
    const inputs = containerRef.current?.querySelectorAll(`[${inputAttr}]`)
    inputs?.forEach(adjustItemText)
  }, [items.length, inputAttr])

  const push = (newItems) => {
    setItems(newItems)
    onChange({ items: newItems })
  }

  const addItem = () => {
    const newItem = isChecklist
      ? { id: crypto.randomUUID(), text: '', checked: false }
      : { id: crypto.randomUUID(), text: '' }
    const nextItems = [...items, newItem]
    push(nextItems)

    setTimeout(() => {
      const inputs = containerRef.current?.querySelectorAll(`[${inputAttr}]`)
      inputs?.[inputs.length - 1]?.focus()
    }, 50)
  }

  const updateItem = (id, field, value) =>
    push(items.map(item => item.id === id ? { ...item, [field]: value } : item))

  const removeItem = (id) =>
    push(items.filter(item => item.id !== id))

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= items.length) return
    const nextItems = [...items]
    const [moved] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, moved)
    push(nextItems)
  }

  const handleDragStart = (e, idx) => {
    dragFromIndex.current = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', items[idx].id)
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    const fromIndex = dragFromIndex.current ?? items.findIndex(item => item.id === draggedId)
    dragFromIndex.current = null
    if (fromIndex === null || fromIndex === -1 || fromIndex === toIndex) return
    moveItem(fromIndex, toIndex)
  }

  const handleReorderKeyDown = (e, idx) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveItem(idx, idx - 1)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveItem(idx, idx + 1)
    }
  }

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem() }
    if (e.key === 'Backspace' && items[idx].text === '' && items.length > 1) {
      e.preventDefault()
      push(items.filter((_, i) => i !== idx))
    }
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-start gap-2 group py-0.5"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, idx)}
        >
          {isChecklist ? (
            <button
              type="button"
              onClick={() => updateItem(item.id, 'checked', !item.checked)}
              aria-label={item.checked ? 'Mark item as not done' : 'Mark item as done'}
              aria-pressed={item.checked}
              className="shrink-0 mt-0.5 text-text-muted hover:text-accent transition-colors"
            >
              {item.checked
                ? <CheckSquare size={16} className="text-accent" />
                : <Square size={16} />}
            </button>
          ) : isNumbered ? (
            <span className="shrink-0 mt-1 min-w-[1.4rem] text-right text-sm font-medium text-text-muted tabular-nums select-none">
              {idx + 1}.
            </span>
          ) : (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-text-muted mt-2" />
          )}

          <textarea
            {...(isChecklist ? { 'data-checklist-input': true } : { 'data-menu-input': true })}
            value={item.text}
            onChange={e => {
              updateItem(item.id, 'text', e.target.value)
              adjustItemText(e.target)
            }}
            onKeyDown={e => handleKeyDown(e, idx)}
            placeholder={isChecklist ? 'List item…' : 'Item…'}
            rows={1}
            className={`flex-1 min-w-0 bg-transparent text-sm leading-relaxed focus:outline-none placeholder-text-muted resize-none overflow-hidden whitespace-pre-wrap break-words ${
              isChecklist && item.checked ? 'line-through text-text-muted' : 'text-text-primary'
            }`}
          />

          <div className="flex shrink-0 items-center gap-0.5">
            <ReorderBtn
              onDragStart={e => handleDragStart(e, idx)}
              onDragEnd={() => { dragFromIndex.current = null }}
              onKeyDown={e => handleReorderKeyDown(e, idx)}
            />
            <DelBtn onClick={() => removeItem(item.id)} />
          </div>
        </div>
      ))}

      <button
        onClick={addItem}
        className="flex items-center gap-2 text-text-muted hover:text-accent text-sm transition-colors mt-2 py-1"
      >
        <Plus size={14} /> Add item
      </button>
    </div>
  )
}

export function ChecklistEditor(props) {
  return <ListEditor {...props} variant="checkbox" />
}

export function MenuListEditor(props) {
  return <ListEditor {...props} variant="bullet" />
}

export function NumberedListEditor(props) {
  return <ListEditor {...props} variant="numbered" />
}


// ─────────────────────────────────────────────────────────
// CardListEditor
// ─────────────────────────────────────────────────────────

/**
 * Card-based editor - each card has a title and description.
 *
 * @param {{ content: { items: Array }, onChange: Function }} props
 */
export function CardListEditor({ content, onChange }) {
  const [items, setItems] = useState(content?.items || [])
  const dragFromIndex = useRef(null)

  const adjust = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const push = (newItems) => {
    setItems(newItems)
    onChange({ items: newItems })
  }

  const addItem = () =>
    push([...items, { id: crypto.randomUUID(), title: '', description: '' }])

  const updateItem = (id, field, value) =>
    push(items.map(item => item.id === id ? { ...item, [field]: value } : item))

  const removeItem = (id) =>
    push(items.filter(item => item.id !== id))

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= items.length) return
    const nextItems = [...items]
    const [moved] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, moved)
    push(nextItems)
  }

  const handleDragStart = (e, idx) => {
    dragFromIndex.current = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', items[idx].id)
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    const fromIndex = dragFromIndex.current ?? items.findIndex(item => item.id === draggedId)
    dragFromIndex.current = null
    if (fromIndex === null || fromIndex === -1 || fromIndex === toIndex) return
    moveItem(fromIndex, toIndex)
  }

  const handleReorderKeyDown = (e, idx) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); moveItem(idx, idx - 1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveItem(idx, idx + 1) }
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="group bg-bg-elevated border border-bg-border rounded-xl p-3 space-y-2"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, idx)}
        >
          <div className="flex items-center gap-2">
            <input
              value={item.title}
              onChange={e => updateItem(item.id, 'title', e.target.value)}
              placeholder="Title…"
              className="flex-1 bg-transparent text-sm font-semibold focus:outline-none text-text-primary placeholder-text-muted"
            />
            <ReorderBtn
              onDragStart={e => handleDragStart(e, idx)}
              onDragEnd={() => { dragFromIndex.current = null }}
              onKeyDown={e => handleReorderKeyDown(e, idx)}
            />
            <DelBtn onClick={() => removeItem(item.id)} label="Delete card" />
          </div>

          <textarea
            ref={adjust}
            value={item.description}
            onChange={e => {
              updateItem(item.id, 'description', e.target.value)
              adjust(e.target)
            }}
            placeholder="Description…"
            rows={2}
            className="w-full bg-transparent text-sm text-text-secondary focus:outline-none placeholder-text-muted resize-none overflow-hidden leading-relaxed"
          />
        </div>
      ))}

      <button
        onClick={addItem}
        className="flex items-center gap-2 text-text-muted hover:text-accent text-sm transition-colors py-1"
      >
        <Plus size={14} /> Add card
      </button>
    </div>
  )
}
