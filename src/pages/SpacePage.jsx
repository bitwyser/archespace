/**
 * View and manage the items within a single space. Data flows through the
 * useSpaces / useSpaceItems hooks; this page only triggers their mutations.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, CheckSquare, ListChecks, FileDown, LayoutGrid, List, FolderPlus, Search, SearchX, X } from 'lucide-react'
import { useDragReorder } from '../hooks/useDragReorder'
import { useSpaces } from '../hooks/useSpaces'
import { useItemBoard } from '../hooks/useItemBoard'
import ItemBoardModals from '../components/ItemBoardModals'
import { useToast } from '../context/ToastCore'
import { useRegisterPageActions } from '../context/PageActionsCore'
import { useCommandPalette } from '../context/CommandPaletteCore'
import { useShortcut } from '../context/ShortcutsCore'
import SpaceItem from '../components/SpaceItem'
import { SpaceCard } from '../components/space/SpaceCard'
import { SpaceModal } from '../components/space/SpaceModal'
import { exportSpaceToPdf } from '../lib/pdfExport'
import BulkSelectionBar from '../components/BulkSelectionBar'
import { BULK_ICONS } from '../components/BulkSelectionIcons'
import { ConfirmDialog } from '../components/ui/UI'
import { SortMenu } from '../components/ui/SortMenu'
import { usePersistedSort } from '../hooks/usePersistedSort'
import { useSpaceStats } from '../hooks/useSpaceStats'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useRouteMeta } from '../hooks/useRouteMeta'
import { sortEntities } from '../lib/sortEntities'

export default function SpacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Single call to useSpaces (avoids duplicate subscriptions)
  const {
    data: spaces = [],
    create: createSpace,
    update: updateSpace,
    togglePin: toggleSpacePin,
    remove: removeSpace,
    archive: archiveSpace,
    duplicate: duplicateSpace,
  } = useSpaces()

  // Items, their card callbacks, unsaved-edit guard and item dialogs.
  const board = useItemBoard(id)
  const { items, isLoading } = board
  const { reorder, bulkArchive, bulkSetPinned, bulkDuplicate } = board.api

  /** The space object for this page */
  const space = spaces.find(c => c.id === id)
  // One-level nesting: sub-spaces live under a top-level space only.
  const isTopLevel = space ? !space.parent_id : false
  const parentSpace = space?.parent_id ? spaces.find(s => s.id === space.parent_id) : null
  const subSpaces = useMemo(() => spaces.filter(s => s.parent_id === id), [spaces, id])
  const { data: spaceStats = {} } = useSpaceStats()
  const [spaceModal, setSpaceModal] = useState(null) // { type:'create' } | { type:'edit', col }
  const [spaceDeleteConfirm, setSpaceDeleteConfirm] = useState(null)

  // Private route: noindex, and a generic tab title - never the space name,
  // which would leak private data into the browser tab, history, and app
  // switcher. Item names are likewise kept out of the title.
  useRouteMeta({ title: 'Space' })

  const { registerCommands, closePalette } = useCommandPalette()

  // ── Local UI state ──
  const [selectMode, setSelectMode]       = useState(false)
  const [selectedIds, setSelectedIds]     = useState(() => new Set())
  const [itemSort, setItemSort] = usePersistedSort('arche-sort-items')

  // While inside a space, expose a "New item" entry in the command palette
  // and bind it to the same "I" shortcut advertised there.
  const { openAddItem } = board
  useShortcut('new-item', openAddItem)
  useEffect(() => registerCommands([
    { id: 'new-item', label: 'New item', hint: 'I', icon: Plus, run: () => { closePalette(); openAddItem() } },
  ]), [registerCommands, closePalette, openAddItem])

  // ── Tag filter (within this space) ──
  const [selectedTags, setSelectedTags] = useState([])
  const allTags = useMemo(() => {
    const set = new Set()
    for (const it of items) for (const t of (it.tags || [])) set.add(t)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])
  // Only selected tags that some item still carries take effect. A selected
  // tag that was just removed from every item (its pill disappears) would
  // otherwise leave the filter matching nothing and the space looking empty.
  const activeTags = useMemo(
    () => selectedTags.filter(t => allTags.includes(t)),
    [selectedTags, allTags]
  )
  const toggleTagFilter = useCallback((tag) => {
    setSelectedTags(prev => {
      // Drop stale selections so a removed tag doesn't come back into effect
      // if it is re-added later.
      const current = prev.filter(t => allTags.includes(t))
      return current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    })
  }, [allTags])
  // ── In-space search (item title + tags) ──
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim().toLowerCase()

  // An item matches when it carries any of the active tags (OR) and, while
  // searching, its title or one of its tags contains the query.
  const visibleItems = useMemo(() => {
    if (activeTags.length === 0 && !trimmedQuery) return items
    return items.filter(it => {
      const tags = it.tags || []
      if (activeTags.length > 0 && !tags.some(t => activeTags.includes(t))) return false
      if (trimmedQuery) {
        const inTitle = (it.title || '').toLowerCase().includes(trimmedQuery)
        const inTags = tags.some(t => t.toLowerCase().includes(trimmedQuery))
        if (!inTitle && !inTags) return false
      }
      return true
    })
  }, [items, activeTags, trimmedQuery])

  const sortedItems = useMemo(
    () => sortEntities(visibleItems, itemSort, i => i.title),
    [visibleItems, itemSort]
  )
  // Grid (masonry) and list share the same items; list is a single column.
  const online = useOnlineStatus()
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('arche:items-view')
      if (saved === 'list' || saved === 'grid') return saved
    } catch { /* storage unavailable */ }
    // No saved preference: grid on large screens, list on mobile.
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 'list' : 'grid'
  })
  const changeViewMode = (mode) => {
    setViewMode(mode)
    try { localStorage.setItem('arche:items-view', mode) } catch { /* storage unavailable */ }
  }

  // On small screens grid cards are narrow (two columns), so render them denser
  // (smaller text and padding) while still showing the full item content.
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = (e) => setIsSmallScreen(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const denseItems = viewMode === 'grid' && isSmallScreen

  // Grid is a round-robin masonry (2 columns, 3 on xl) so the sort order reads
  // left-to-right across the top row - pinned/newest items stay at the top.
  const [gridCols, setGridCols] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches ? 3 : 2),
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = (e) => setGridCols(e.matches ? 3 : 2)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Manual drag order (in both list and grid views) only applies to the
  // default sort; other sorts and select mode disable it.
  const reorderDisabled = selectMode || itemSort !== 'default' || activeTags.length > 0 || !!trimmedQuery

  const selectedCount = selectedIds.size
  const selectedItems = useMemo(
    () => items.filter(i => selectedIds.has(i.id)),
    [items, selectedIds]
  )
  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggleSelected = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const { closeAll: closeItemDialogs } = board
  const pageActions = useMemo(() => ({
    onEscape: () => {
      closeItemDialogs()
      exitSelectMode()
    },
  }), [closeItemDialogs, exitSelectMode])
  useRegisterPageActions(pageActions)

  const dragItemRef = useRef(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })

  const {
    dragIndex, dragOverIndex,
    handleDragStart: onDragStart, handleDragOver, handleDrop, handleDragEnd,
  } = useDragReorder({
    disabled: reorderDisabled,
    onDrop: (fromIndex, toIndex) => {
      const reordered = [...items]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      reorder.mutate(reordered, {
        onError: () => toast.error("Couldn't reorder items."),
      })
    },
  })

  const handleItemDragStart = useCallback((index) => {
    onDragStart(index)
    dragItemRef.current = itemsRef.current[index]
  }, [onDragStart])

  const runBulkAction = async (fn) => {
    if (selectedCount === 0) return
    if (board.hasDirty([...selectedIds])) {
      toast.error('Save or discard unsaved changes before bulk actions')
      return
    }
    try {
      await fn()
      exitSelectMode()
    } catch {
      toast.error("Couldn't complete that action.")
    }
  }

  // ── Not found state ──
  if (!space && !isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Space not found</p>
          <button onClick={() => navigate('/app')} className="text-accent text-sm hover:underline">Go back</button>
        </div>
      </div>
    )
  }

  const renderItemCard = (item, index) => (
    <div
      key={item.id}
      data-item-id={item.id}
      onDragOver={reorderDisabled ? undefined : (e) => handleDragOver(e, index)}
      onDrop={reorderDisabled ? undefined : () => handleDrop(index)}
      className={`transition-all duration-300 animate-fade-in-up ${
        !reorderDisabled && dragOverIndex === index && dragIndex !== index
          ? 'border-t-2 border-accent pt-1'
          : ''
      } ${!reorderDisabled && dragIndex === index ? 'opacity-40 scale-95' : ''} ${
        board.flashItemId === item.id ? 'rounded-2xl ring-2 ring-accent' : ''
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <SpaceItem
        item={item}
        index={index}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onSelectedChange={toggleSelected}
        forcedCollapsed={board.collapsedIds.has(item.id)}
        {...board.cardProps}
        onDragStart={handleItemDragStart}
        onDragEnd={handleDragEnd}
        dragDisabled={reorderDisabled}
        dense={denseItems}
      />
    </div>
  )

  // Sub-spaces render as space cards in the same layout as items, listed first.
  const renderSubSpaceCard = (sub, i) => (
    <SpaceCard
      key={sub.id}
      col={sub}
      index={i}
      search=""
      layout={viewMode === 'grid' ? 'grid' : 'list'}
      stats={spaceStats}
      reorderDisabled
      dragIndex={-1}
      dragOverIndex={-1}
      handleDragStart={() => {}}
      handleDragOver={() => {}}
      handleDrop={() => {}}
      handleDragEnd={() => {}}
      navigate={navigate}
      togglePin={toggleSpacePin}
      setModal={setSpaceModal}
      setDeleteConfirm={setSpaceDeleteConfirm}
      onDuplicate={(sid) => duplicateSpace.mutate(sid, {
        onSuccess: () => toast.success('Space duplicated'),
        onError: () => toast.error("Couldn't duplicate the space."),
      })}
      onArchive={(sid) => archiveSpace.mutate(sid, {
        onSuccess: () => toast.success('Space archived'),
        onError: () => toast.error("Couldn't archive the space."),
      })}
    />
  )

  // Sub-spaces, then items, as separate sections (sub-spaces hide while
  // selecting items). Each is labelled only when both show.
  const subSpaceNodes = selectMode ? [] : subSpaces.map((sub, i) => renderSubSpaceCard(sub, i))
  const itemNodes = sortedItems.map((item, index) => renderItemCard(item, index))
  const labelSections = subSpaceNodes.length > 0 && itemNodes.length > 0
  const sectionLabelClass = 'mb-3 px-1 text-base font-semibold text-text-primary'

  // One section's cards: round-robin masonry in grid view, one column in list.
  const renderSection = (nodes) => (viewMode === 'grid' ? (
    <div className="flex items-start gap-2 sm:gap-3">
      {Array.from({ length: gridCols }, (_, col) => (
        <div key={col} className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-3">
          {nodes.filter((_, i) => i % gridCols === col)}
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-3">
      {nodes}
    </div>
  ))

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">

      {/* ── Sticky header ──────────────────────────────── */}
      <header className="sticky top-0 z-20 glass">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          {/* Back button - to the parent space for a sub-space, else the dashboard */}
          <button
            onClick={() => navigate(parentSpace ? `/space/${parentSpace.id}` : '/app')}
            title={parentSpace ? `Back to ${parentSpace.name}` : 'Back'}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline max-w-[140px] truncate">{parentSpace ? parentSpace.name : 'Back'}</span>
          </button>

          {/* Space title & description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-text-primary truncate">{space?.name}</h1>
            {space?.description && (
              <p className="text-xs text-text-muted truncate mt-0.5">{space.description}</p>
            )}
          </div>

          {/* Unsaved badge */}
          {board.dirtyItems.size > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-1 shrink-0">
              {board.dirtyItems.size} unsaved
            </span>
          )}

          {/* Header actions */}
          {/* Header actions: things done to the space itself. The view, sort and
              select controls live in the search row above the items. */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {items.length > 0 && !selectMode && (
              <button
                type="button"
                onClick={() => exportSpaceToPdf(space, items)}
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all"
                title="Export space as PDF"
                aria-label="Export space as PDF"
              >
                <FileDown size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            {isTopLevel && !selectMode && (
              <button
                type="button"
                onClick={() => setSpaceModal({ type: 'create' })}
                disabled={!online}
                title={online ? 'New sub-space' : 'Unavailable offline'}
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FolderPlus size={16} />
                <span className="hidden sm:inline">New space</span>
              </button>
            )}
            <button
              type="button"
              onClick={openAddItem}
              disabled={!online}
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-xl p-2 sm:px-3 sm:py-2 text-sm font-semibold transition-colors shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              title={online ? 'Add item' : 'Unavailable offline'}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Add item</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────── */}
      <main className={`flex-1 flex flex-col px-2 sm:px-4 pt-6 ${selectMode ? 'pb-32' : 'pb-6'} ${viewMode === 'grid' ? '' : 'max-w-5xl mx-auto w-full'}`}>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-bg-border rounded-2xl p-4 bg-bg-surface animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-16 h-6 bg-bg-elevated rounded"></div>
                  <div className="w-1/3 h-4 bg-bg-elevated rounded"></div>
                  <div className="ml-auto w-24 h-6 bg-bg-elevated rounded"></div>
                </div>
                <div className="h-16 bg-bg-elevated rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : (items.length === 0 && subSpaces.length === 0) ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-bg-border flex items-center justify-center mx-auto mb-4">
              <Plus size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium">Nothing here yet</p>
            <p className="text-text-muted text-sm mt-1">Add your first item to this space</p>
            <button
              onClick={openAddItem}
              disabled={!online}
              title={online ? undefined : 'Unavailable offline'}
              className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> Add first item
            </button>
          </div>
        ) : (
          /* Items in list (single column) or grid (round-robin masonry) view */
          <>
            {/* Search row: compact in-space search (item titles and tags) on the
                left; the view, sort and select controls right-aligned. In select
                mode the search gives way to Select all + Done, with Done where
                Select was. Heights match SortMenu (32px phone, 38px desktop). */}
            {items.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                {!selectMode && (
                  <div className="flex h-8 sm:h-[38px] min-w-0 flex-1 sm:max-w-md items-center gap-2 rounded-full bg-bg-card pl-3.5 pr-1.5 focus-within:ring-1 focus-within:ring-accent-border transition-shadow">
                    <Search size={15} className="shrink-0 text-text-muted" />
                    <input
                      type="text"
                      enterKeyHint="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape' && query) {
                          e.stopPropagation()
                          setQuery('')
                        }
                      }}
                      placeholder="Search items"
                      aria-label="Search items in this space"
                      className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text-primary placeholder-text-muted focus:outline-none"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        title="Clear"
                        className="shrink-0 rounded-full p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {!selectMode && (
                    <div className="flex items-center gap-1 p-0.5 sm:p-1 rounded-xl border border-bg-border bg-bg-surface">
                      <button
                        type="button"
                        onClick={() => changeViewMode('grid')}
                        aria-label="Grid view"
                        aria-pressed={viewMode === 'grid'}
                        title="Grid view"
                        className={`p-[5px] sm:p-1.5 rounded-lg transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-accent-muted text-accent'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => changeViewMode('list')}
                        aria-label="List view"
                        aria-pressed={viewMode === 'list'}
                        title="List view"
                        className={`p-[5px] sm:p-1.5 rounded-lg transition-colors ${
                          viewMode === 'list'
                            ? 'bg-accent-muted text-accent'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <List size={16} />
                      </button>
                    </div>
                  )}
                  {!selectMode && items.length > 1 && (
                    <SortMenu value={itemSort} onChange={setItemSort} />
                  )}
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(items.map(i => i.id)))}
                      title="Select all"
                      aria-label="Select all"
                      className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all"
                    >
                      <ListChecks size={14} />
                      <span className="hidden sm:inline">Select all</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                    title={selectMode ? 'Done' : 'Select'}
                    aria-label={selectMode ? 'Done selecting' : 'Select items'}
                    className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all"
                  >
                    <CheckSquare size={14} />
                    <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
                  </button>
                </div>
              </div>
            )}
            {allTags.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(() => {
                  const pill = (active) =>
                    `text-[13px] font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-accent-muted border-accent-border text-accent'
                        : 'bg-bg-surface border-bg-border text-text-secondary hover:text-text-primary'
                    }`
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        aria-pressed={activeTags.length === 0}
                        className={pill(activeTags.length === 0)}
                      >
                        All
                      </button>
                      {allTags.map(tag => {
                        const active = activeTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTagFilter(tag)}
                            aria-pressed={active}
                            className={pill(active)}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            )}
            {/* A search or tag filter that matches nothing (the search bar above
                stays usable). */}
            {sortedItems.length === 0 && items.length > 0 && (trimmedQuery || activeTags.length > 0) && (
              <div className="flex flex-col items-center px-6 pt-12 pb-6 text-center">
                <SearchX size={36} className="text-text-muted" />
                <p className="mt-3 font-medium text-text-secondary">No matching items</p>
                <p className="mt-1 text-sm text-text-muted">
                  {trimmedQuery ? `No items match "${query.trim()}".` : 'No items have the selected tags.'}
                </p>
              </div>
            )}
            {labelSections && <h2 className={sectionLabelClass}>Spaces</h2>}
            {subSpaceNodes.length > 0 && renderSection(subSpaceNodes)}
            {labelSections && <h2 className={`${sectionLabelClass} mt-6`}>Items</h2>}
            {itemNodes.length > 0 && renderSection(itemNodes)}

            <BulkSelectionBar
              count={selectedCount}
              onClear={exitSelectMode}
              actions={[
                {
                  id: 'pin',
                  label: 'Pin',
                  icon: BULK_ICONS.pin,
                  onClick: () => runBulkAction(() =>
                    bulkSetPinned.mutateAsync({ ids: [...selectedIds], pinned: true }).then(() =>
                      toast.success(`Pinned ${selectedCount} items`)
                    )
                  ),
                },
                {
                  id: 'unpin',
                  label: 'Unpin',
                  icon: BULK_ICONS.unpin,
                  onClick: () => runBulkAction(() =>
                    bulkSetPinned.mutateAsync({ ids: [...selectedIds], pinned: false }).then(() =>
                      toast.success('Unpinned items')
                    )
                  ),
                },
                {
                  id: 'collapse',
                  label: 'Collapse',
                  icon: BULK_ICONS.collapse,
                  onClick: () => {
                    board.setManyCollapsed([...selectedIds], true)
                    toast.info(`Collapsed ${selectedCount} items`)
                  },
                },
                {
                  id: 'expand',
                  label: 'Expand',
                  icon: BULK_ICONS.expand,
                  onClick: () => {
                    board.setManyCollapsed([...selectedIds], false)
                    toast.info('Expanded items')
                  },
                },
                {
                  id: 'duplicate',
                  label: 'Duplicate',
                  icon: BULK_ICONS.copy,
                  onClick: () => runBulkAction(() =>
                    bulkDuplicate.mutateAsync(selectedItems).then(() =>
                      toast.success(`Duplicated ${selectedCount} items`)
                    )
                  ),
                },
                {
                  id: 'move',
                  label: 'Move',
                  icon: BULK_ICONS.move,
                  onClick: () => board.openMoveItems(selectedItems.map(item => item.id), exitSelectMode),
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: BULK_ICONS.archive,
                  onClick: () => runBulkAction(() =>
                    bulkArchive.mutateAsync([...selectedIds]).then(() =>
                      toast.success(`Archived ${selectedCount} items`)
                    )
                  ),
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  icon: BULK_ICONS.trash,
                  variant: 'danger',
                  onClick: () => board.requestBulkDelete([...selectedIds], exitSelectMode),
                },
              ]}
            />
          </>
        )}
      </main>

      {/* ── Sub-space create / edit modal ────────────── */}
      {spaceModal?.type === 'create' && (
        <SpaceModal
          onSave={({ name, description, color, tags }) => {
            createSpace.mutate({ name, description, color, tags, parentId: id }, {
              onSuccess: () => toast.success('Space created'),
              onError: () => toast.error("Couldn't create space."),
            })
          }}
          onClose={() => setSpaceModal(null)}
        />
      )}
      {spaceModal?.type === 'edit' && (
        <SpaceModal
          initial={spaceModal.col}
          onSave={({ name, description, color, tags }) => {
            updateSpace.mutate({ id: spaceModal.col.id, name, description, color, tags }, {
              onSuccess: () => toast.success('Space updated'),
              onError: () => toast.error("Couldn't update space."),
            })
          }}
          onClose={() => setSpaceModal(null)}
        />
      )}
      {spaceDeleteConfirm && (
        <ConfirmDialog
          title="Move space to recycle bin?"
          message="This space and all its items will be moved to the recycle bin."
          confirmLabel="Move to recycle bin"
          destructive
          onConfirm={() => {
            removeSpace.mutate(spaceDeleteConfirm, {
              onSuccess: () => toast.success('Space moved to recycle bin'),
              onError: () => toast.error("Couldn't delete space."),
            })
            setSpaceDeleteConfirm(null)
          }}
          onClose={() => setSpaceDeleteConfirm(null)}
        />
      )}

      {/* ── Item dialogs: add, move to bin, move, unsaved-edit guard ── */}
      <ItemBoardModals board={board} spaces={spaces} />
    </div>
  )
}
