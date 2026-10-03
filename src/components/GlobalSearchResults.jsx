import { useEffect, useRef } from 'react'
import { Folder } from 'lucide-react'
import { TypeBadge } from './ui/TypeBadge'
import { MENU_HEADING, menuItemClass } from './ui/menuStyles'
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

  const optionClass = (active) => menuItemClass({ highlighted: active })

  return (
    // Keep the search input focused when clicking anywhere in the dropdown
    // (buttons or padding), so its onBlur can hide results immediately.
    <div className={className} onMouseDown={(e) => e.preventDefault()}>
      {!hasResults ? (
        <p className="px-2 py-1.5 text-xs text-text-muted">No results for &ldquo;{search}&rdquo;</p>
      ) : (
        <div ref={listRef} role="listbox" id={listboxId} aria-label="Search results">
          {spaces.length > 0 && (
            <section>
              <p className={MENU_HEADING}>Spaces</p>
              <div>
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
                      <span className="text-text-primary truncate">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          {items.length > 0 && (
            <section className={spaces.length > 0 ? 'mt-1' : ''}>
              <p className={MENU_HEADING}>Items</p>
              <div>
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
                      <TypeBadge type={item.type} size={12} />
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate">{item.title || 'Untitled'}</p>
                        <p className="text-[11px] font-normal text-text-muted truncate">
                          {itemMeta?.[item.id]?.spaceName}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {globalMatches.items.length > SEARCH_ITEM_DISPLAY_LIMIT && (
                <p className="px-2 pt-1 pb-1.5 text-[11px] text-text-muted">+{globalMatches.items.length - SEARCH_ITEM_DISPLAY_LIMIT} more items</p>
              )}
            </section>
          )}
        </div>
      )}
      {truncated && (
        <p className="mt-1 border-t border-bg-border px-2 pt-1.5 pb-1 text-[11px] text-text-muted">
          Only your {GLOBAL_SEARCH_RESULT_LIMIT} most recent spaces and items are searched. Refine your search if something's missing.
        </p>
      )}
    </div>
  )
}
