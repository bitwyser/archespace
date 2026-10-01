import { useEffect, useRef } from 'react'
import { Folder } from 'lucide-react'
import { TypeBadge } from './ui/TypeBadge'
import { GLOBAL_SEARCH_RESULT_LIMIT } from '../lib/constants'
import { SEARCH_ITEM_DISPLAY_LIMIT, searchOptionId } from '../lib/search'

export default function GlobalSearchResults({
  search,
  globalMatches,
  itemMeta,
  onSelectSpace,
  onSelectItem,
  activeOptionId,
  listboxId = 'global-search-listbox',
  truncated = false,
  className = '',
}) {
  const spaces = globalMatches.spaces
  const items = globalMatches.items.slice(0, SEARCH_ITEM_DISPLAY_LIMIT)
  const hasResults = spaces.length > 0 || items.length > 0
  const listRef = useRef(null)

  // Keep the active (keyboard-highlighted) option scrolled into view.
  useEffect(() => {
    if (!activeOptionId) return
    listRef.current?.querySelector(`[id="${activeOptionId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeOptionId])

  const optionClass = (active) =>
    `w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm ${
      active ? 'bg-accent-muted text-text-primary' : 'hover:bg-bg-elevated'
    }`

  return (
    // Keep the search input focused when clicking anywhere in the dropdown
    // (buttons or padding), so its onBlur can hide results immediately.
    <div className={className} onMouseDown={(e) => e.preventDefault()}>
      {!hasResults ? (
        <p className="text-sm text-text-muted py-2 px-1">No results for &ldquo;{search}&rdquo;</p>
      ) : (
        <div ref={listRef} role="listbox" id={listboxId} aria-label="Search results">
          {spaces.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Spaces</p>
              <div className="space-y-1">
                {spaces.map(c => {
                  const optId = searchOptionId('space', c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      id={optId}
                      aria-selected={optId === activeOptionId}
                      onClick={() => onSelectSpace(c.id)}
                      className={optionClass(optId === activeOptionId)}
                    >
                      <Folder size={14} className="text-accent shrink-0" />
                      <span className="font-medium text-text-primary truncate">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          {items.length > 0 && (
            <section className={spaces.length > 0 ? 'mt-3' : ''}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Items</p>
              <div className="space-y-1">
                {items.map(item => {
                  const optId = searchOptionId('item', item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      id={optId}
                      aria-selected={optId === activeOptionId}
                      onClick={() => onSelectItem(item)}
                      className={optionClass(optId === activeOptionId)}
                    >
                      <TypeBadge type={item.type} size={13} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">{item.title || 'Untitled'}</p>
                        <p className="text-xs text-text-muted truncate">
                          {itemMeta?.[item.id]?.spaceName}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {globalMatches.items.length > SEARCH_ITEM_DISPLAY_LIMIT && (
                <p className="text-xs text-text-muted mt-2 px-3">+{globalMatches.items.length - SEARCH_ITEM_DISPLAY_LIMIT} more items</p>
              )}
            </section>
          )}
        </div>
      )}
      {truncated && (
        <p className="text-[11px] text-text-muted mt-3 px-1 pt-2 border-t border-bg-border">
          Only your {GLOBAL_SEARCH_RESULT_LIMIT} most recent spaces and items are searched. Refine your search if something's missing.
        </p>
      )}
    </div>
  )
}
