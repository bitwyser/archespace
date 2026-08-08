/**
 * SpaceCard.jsx - A single space on the dashboard.
 *
 * `layout="grid"` (default) renders the full card; `layout="list"` renders a
 * compact full-width row (colour bar, name, description, tags, item count).
 * Both share the same navigate / select / drag / action-menu behaviour.
 */
import { ChevronRight, Check, Pin, PinOff, Pencil, Trash2, Copy, Archive, CheckSquare, Square } from 'lucide-react'
import { getColorPreset } from '../../lib/spaceColors'
import { ActionMenu } from '../ui/ActionMenu'

export function SpaceCard({
  col, index, search, dragIndex, dragOverIndex,
  handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  navigate, togglePin, setModal, setDeleteConfirm, onDuplicate, onArchive,
  stats,
  layout = 'grid',
  selectMode = false,
  selected = false,
  onToggleSelect,
  reorderDisabled = false,
}) {
  const colorPreset = getColorPreset(col.color)
  const itemStats = stats?.[col.id]
  const itemLabel = itemStats
    ? `${itemStats.total} ${itemStats.total === 1 ? 'item' : 'items'}`
    : '0 items'

  const activate = () => (selectMode ? onToggleSelect?.() : navigate(`/space/${col.id}`))

  // Only act when the row/card itself is focused, so Enter/Space on a nested
  // control (the ActionMenu button) doesn't also navigate.
  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }

  const menuActions = [
    {
      id: 'pin',
      label: col.pinned ? 'Unpin' : 'Pin',
      icon: col.pinned ? PinOff : Pin,
      active: col.pinned,
      onClick: () => togglePin.mutate({ id: col.id, pinned: col.pinned }),
    },
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => setModal({ type: 'edit', col }) },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => onDuplicate?.(col.id) },
    { id: 'archive', label: 'Archive', icon: Archive, onClick: () => onArchive?.(col.id) },
    { id: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: () => setDeleteConfirm(col.id) },
  ]

  const dragProps = {
    draggable: !search && !selectMode && !reorderDisabled,
    onDragStart: () => !selectMode && handleDragStart(index),
    onDragOver: (e) => !selectMode && handleDragOver(e, index),
    onDrop: () => !selectMode && handleDrop(index),
    onDragEnd: handleDragEnd,
  }

  const ariaLabel = selectMode
    ? `${selected ? 'Deselect' : 'Select'} space: ${col.name}`
    : `Open space: ${col.name}`

  // ── List row ──────────────────────────────────────────────
  if (layout === 'list') {
    return (
      <div
        {...dragProps}
        onClick={activate}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={selectMode ? selected : undefined}
        aria-label={ariaLabel}
        className={`group relative flex items-center gap-3 sm:gap-4 border rounded-xl pl-4 pr-3 py-3 cursor-pointer transition-colors animate-fade-in-up ${
          selected ? 'ring-1 ring-accent border-accent bg-accent/5' :
          col.pinned ? 'bg-accent/5 border-accent hover:border-accent/80' : 'bg-bg-surface border-bg-border hover:border-accent/40'
        } ${!selectMode && dragIndex === index ? 'opacity-40' : ''}`}
        style={{
          animationDelay: `${index * 30}ms`,
          borderLeftWidth: colorPreset ? '3px' : undefined,
          borderLeftColor: colorPreset?.value,
        }}
      >
        {selectMode && (
          <span className="shrink-0 text-accent">
            {selected ? <CheckSquare size={16} /> : <Square size={16} className="text-text-muted" />}
          </span>
        )}
        {col.pinned && <Pin size={14} className="shrink-0 text-accent fill-accent" />}

        <h3 className="font-semibold text-text-primary truncate shrink-0 w-32 sm:w-44">{col.name}</h3>

        {col.description
          ? <p className="text-text-secondary text-sm truncate flex-1 min-w-0">{col.description}</p>
          : <span className="flex-1 min-w-0" />}

        {Array.isArray(col.tags) && col.tags.length > 0 && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {col.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-bg-elevated text-text-muted border border-bg-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="text-text-muted text-xs shrink-0 whitespace-nowrap tabular-nums">{itemLabel}</p>

        {!selectMode && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <ActionMenu label="Space actions" actions={menuActions} />
          </div>
        )}
        {!selectMode && (
          <ChevronRight size={16} className="shrink-0 text-text-muted group-hover:text-accent transition-colors" />
        )}
      </div>
    )
  }

  // ── Grid card ─────────────────────────────────────────────
  return (
    <div
      {...dragProps}
      onClick={activate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? selected : undefined}
      aria-label={ariaLabel}
      className={`group relative border rounded-2xl p-4 cursor-pointer hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up ${
        selected ? 'ring-1 ring-accent border-accent bg-accent/5' :
        col.pinned ? 'bg-accent/5 border-accent hover:border-accent/80' : 'bg-bg-surface border-bg-border hover:border-accent/40'
      } ${
        !selectMode && dragOverIndex === index && dragIndex !== index ? 'border-l-4 border-l-accent pl-3' : ''
      } ${!selectMode && dragIndex === index ? 'opacity-40' : ''}`}
      style={{
        animationDelay: `${index * 50}ms`,
        borderTopWidth: colorPreset ? '3px' : undefined,
        borderTopColor: colorPreset?.value,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {col.pinned && <Pin size={14} className="text-accent shrink-0 fill-accent" />}
            <h3 className="font-semibold text-text-primary truncate">{col.name}</h3>
          </div>
          {col.description && (
            <p className="text-text-secondary text-sm mt-1 line-clamp-2 leading-relaxed">{col.description}</p>
          )}
        </div>
        {selectMode ? (
          <span
            className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
              selected ? 'bg-accent border-accent text-white' : 'border-bg-border text-transparent'
            }`}
          >
            <Check size={14} />
          </span>
        ) : (
          <ChevronRight size={16} className="text-text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
        )}
      </div>
      {Array.isArray(col.tags) && col.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {col.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-bg-elevated text-text-muted border border-bg-border"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-bg-border gap-2">
        <p className="text-text-muted text-xs truncate">{itemLabel}</p>
        {!selectMode && <ActionMenu label="Space actions" actions={menuActions} />}
      </div>
    </div>
  )
}
