/**
 * View and manage the items within a single space. Data flows through the
 * useSpaces / useSpaceItems hooks; this page only triggers their mutations.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useBlocker, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, CheckSquare, ListChecks, FileDown, LayoutGrid, List } from 'lucide-react'
import { ITEM_TYPE_OPTIONS } from '../lib/itemTypes'
import { useDragReorder } from '../hooks/useDragReorder'
import { useSpaces } from '../hooks/useSpaces'
import { useSpaceItems } from '../hooks/useSpaceItems'
import { useToast } from '../context/ToastCore'
import { useRegisterPageActions } from '../context/PageActionsCore'
import { useCommandPalette } from '../context/CommandPaletteCore'
import { useShortcut } from '../context/ShortcutsCore'
import SpaceItem from '../components/SpaceItem'
import { exportSpaceToPdf } from '../lib/pdfExport'
import BulkSelectionBar from '../components/BulkSelectionBar'
import { BULK_ICONS } from '../components/BulkSelectionIcons'
import { Modal } from '../components/ui/UI'
import { SortMenu } from '../components/ui/SortMenu'
import { usePersistedSort } from '../hooks/usePersistedSort'
import { useRouteMeta } from '../hooks/useRouteMeta'
import { sortEntities } from '../lib/sortEntities'

export default function SpacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // Single call to useSpaces (avoids duplicate subscriptions)
  const { data: spaces = [] } = useSpaces()

  const {
    data: items = [],
    isLoading,
    create,
    update,
    togglePin,
    remove,
    reorder,
    archive,
    duplicate,
    move,
    bulkRemove,
    bulkArchive,
    bulkSetPinned,
    bulkDuplicate,
  } = useSpaceItems(id)

  /** The space object for this page */
  const space = spaces.find(c => c.id === id)

  // Private route: noindex, and a generic tab title - never the space name,
  // which would leak private data into the browser tab, history, and app
  // switcher. Item names are likewise kept out of the title.
  useRouteMeta({ title: 'Space' })

  const { registerCommands, closePalette } = useCommandPalette()

  // ── Local UI state ──
  const [addModal, setAddModal]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [dirtyItems, setDirtyItems]       = useState(new Set())
  const [selectMode, setSelectMode]       = useState(false)
  const [selectedIds, setSelectedIds]     = useState(() => new Set())
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null)
  const [moveRequest, setMoveRequest] = useState(null)
  const [flashItemId, setFlashItemId] = useState(null)
  const [itemSort, setItemSort] = usePersistedSort('arche-sort-items')

  // While inside a space, expose a "New item" entry in the command palette
  // and bind it to the same "I" shortcut advertised there.
  const openAddItem = useCallback(() => setAddModal(true), [])
  useShortcut('new-item', openAddItem)
  useEffect(() => registerCommands([
    { id: 'new-item', label: 'New item', hint: 'I', icon: Plus, run: () => { closePalette(); openAddItem() } },
  ]), [registerCommands, closePalette, openAddItem])

  const sortedItems = useMemo(
    () => sortEntities(items, itemSort, i => i.title),
    [items, itemSort]
  )
  // Grid (masonry) and list share the same items; list is a single column.
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
  const reorderDisabled = selectMode || itemSort !== 'default'

  const selectedCount = selectedIds.size
  const selectedItems = useMemo(
    () => items.filter(i => selectedIds.has(i.id)),
    [items, selectedIds]
  )
  const destinationSpaces = useMemo(
    () => spaces.filter(candidate => candidate.id !== id),
    [spaces, id]
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

  const setItemCollapsed = useCallback((id, collapsed) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (collapsed) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const pageActions = useMemo(() => ({
    onEscape: () => {
      setAddModal(false)
      setDeleteConfirm(null)
      setBulkDeleteConfirm(null)
      setMoveRequest(null)
      exitSelectMode()
    },
  }), [exitSelectMode])
  useRegisterPageActions(pageActions)

  const dragItemRef = useRef(null)

  // ── Track dirty state per item for beforeunload ──
  const handleDirtyChange = useCallback((itemId, dirty) => {
    setDirtyItems(prev => {
      const next = new Set(prev)
      dirty ? next.add(itemId) : next.delete(itemId)
      return next
    })
  }, [])

  // ── Stable, memo-friendly per-item callbacks ──
  // Refs hold the latest values so these handlers keep a stable identity; that
  // lets the memoized SpaceItem skip re-rendering the whole list on each edit.
  const dirtyItemsRef = useRef(dirtyItems)
  const itemsRef = useRef(items)
  const toastRef = useRef(toast)
  useEffect(() => {
    dirtyItemsRef.current = dirtyItems
    itemsRef.current = items
    toastRef.current = toast
  })

  const updateAsync = update.mutateAsync
  const togglePinMutate = togglePin.mutate
  const duplicateMutate = duplicate.mutate
  const archiveMutate = archive.mutate

  const handleItemUpdate = useCallback((payload) => updateAsync(payload), [updateAsync])
  const handleTogglePin = useCallback(
    (itemId, pinned) => togglePinMutate({ id: itemId, pinned }),
    [togglePinMutate]
  )
  const handleDuplicateItem = useCallback((it) => duplicateMutate(it, {
    onSuccess: () => toastRef.current.success('Item duplicated'),
    onError: () => toastRef.current.error("Couldn't duplicate the item."),
  }), [duplicateMutate])
  const handleArchiveItem = useCallback((itemId) => archiveMutate(itemId, {
    onSuccess: () => toastRef.current.success('Item archived'),
    onError: () => toastRef.current.error("Couldn't archive the item."),
  }), [archiveMutate])
  const openMoveItems = useCallback((ids) => {
    if (!ids?.length) return
    if (ids.some(itemId => dirtyItemsRef.current.has(itemId))) {
      toastRef.current.error('Save or discard unsaved changes before moving items')
      return
    }
    setMoveRequest({ ids })
  }, [])
  const handleMoveOne = useCallback((itemId) => openMoveItems([itemId]), [openMoveItems])

  // ── Warn on page close / in-app navigation if unsaved edits exist ──
  const hasUnsaved = dirtyItems.size > 0

  useEffect(() => {
    const handler = (e) => {
      if (hasUnsaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  const navBlocker = useBlocker(hasUnsaved)

  // ── Scroll to and briefly highlight an item opened from global search ──
  useEffect(() => {
    const target = location.state?.focusItemId
    if (!target || isLoading) return
    document
      .querySelector(`[data-item-id="${target}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const raf = requestAnimationFrame(() => setFlashItemId(target))
    const timer = setTimeout(() => setFlashItemId(null), 2200)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [location.state, isLoading])

  // ── Add item ──
  const handleAddItem = async (type) => {
    setAddModal(false)
    try {
      await create.mutateAsync({ type, title: '' })
      toast.success(`${ITEM_TYPE_OPTIONS.find(t => t.type === type)?.label || 'Item'} added`)
    } catch {
      toast.error("Couldn't add item.")
    }
  }

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
    const dirtySelected = [...selectedIds].some(id => dirtyItems.has(id))
    if (dirtySelected) {
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

  const handleMoveItems = async (targetSpaceId) => {
    if (!moveRequest?.ids?.length) return
    try {
      await move.mutateAsync({ ids: moveRequest.ids, targetSpaceId })
      const movedCount = moveRequest.ids.length
      const targetSpace = spaces.find(candidate => candidate.id === targetSpaceId)
      toast.success(`Moved ${movedCount} ${movedCount === 1 ? 'item' : 'items'} to ${targetSpace?.name || 'space'}`)
      setMoveRequest(null)
      exitSelectMode()
    } catch {
      toast.error("Couldn't move items.")
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
        flashItemId === item.id ? 'rounded-2xl ring-2 ring-accent' : ''
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <SpaceItem
        item={item}
        index={index}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onSelectedChange={toggleSelected}
        collapsed={collapsedIds.has(item.id)}
        onCollapsedChange={setItemCollapsed}
        onUpdate={handleItemUpdate}
        onTogglePin={handleTogglePin}
        onDelete={setDeleteConfirm}
        onDuplicate={handleDuplicateItem}
        onMove={handleMoveOne}
        onArchive={handleArchiveItem}
        onDirtyChange={handleDirtyChange}
        onDragStart={handleItemDragStart}
        onDragEnd={handleDragEnd}
        dragDisabled={reorderDisabled}
        dense={denseItems}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">

      {/* ── Sticky header ──────────────────────────────── */}
      <header className="sticky top-0 z-20 glass">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate('/app')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Space title & description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-text-primary truncate">{space?.name}</h1>
            {space?.description && (
              <p className="text-xs text-text-muted truncate mt-0.5">{space.description}</p>
            )}
          </div>

          {/* Unsaved badge */}
          {dirtyItems.size > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-1 shrink-0">
              {dirtyItems.size} unsaved
            </span>
          )}

          {/* Header actions */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {items.length > 0 && !selectMode && (
              <div className="flex items-center gap-1 p-1 rounded-xl border border-bg-border bg-bg-surface">
                <button
                  type="button"
                  onClick={() => changeViewMode('grid')}
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  title="Grid view"
                  className={`p-1.5 rounded-lg transition-colors ${
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
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
            )}
            {selectMode && items.length > 0 && (
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
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all"
              >
                <CheckSquare size={14} />
                <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
              </button>
            )}
            {items.length > 1 && !selectMode && (
              <SortMenu value={itemSort} onChange={setItemSort} />
            )}
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
            <button
              type="button"
              onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white rounded-xl p-2 sm:px-3 sm:py-2 text-sm font-semibold transition-colors shadow-lg shadow-accent/20"
              title="Add item"
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
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-bg-border flex items-center justify-center mx-auto mb-4">
              <Plus size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium">Nothing here yet</p>
            <p className="text-text-muted text-sm mt-1">Add your first item to this space</p>
            <button
              onClick={() => setAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Add first item
            </button>
          </div>
        ) : (
          /* Items in list (single column) or grid (round-robin masonry) view */
          <>
            {viewMode === 'grid' ? (
              <div className="flex items-start gap-2 sm:gap-3">
                {Array.from({ length: gridCols }, (_, col) => (
                  <div key={col} className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-3">
                    {sortedItems
                      .map((item, index) => ({ item, index }))
                      .filter(({ index }) => index % gridCols === col)
                      .map(({ item, index }) => renderItemCard(item, index))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedItems.map((item, index) => renderItemCard(item, index))}
              </div>
            )}

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
                    setCollapsedIds(prev => {
                      const next = new Set(prev)
                      selectedIds.forEach(id => next.add(id))
                      return next
                    })
                    toast.info(`Collapsed ${selectedCount} items`)
                  },
                },
                {
                  id: 'expand',
                  label: 'Expand',
                  icon: BULK_ICONS.expand,
                  onClick: () => {
                    setCollapsedIds(prev => {
                      const next = new Set(prev)
                      selectedIds.forEach(id => next.delete(id))
                      return next
                    })
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
                  onClick: () => openMoveItems(selectedItems.map(item => item.id)),
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
                  onClick: () => {
                    const dirtySelected = [...selectedIds].some(id => dirtyItems.has(id))
                    if (dirtySelected) {
                      toast.error('Save or discard unsaved changes first')
                      return
                    }
                    setBulkDeleteConfirm([...selectedIds])
                  },
                },
              ]}
            />
          </>
        )}

        {/* "Add another" button, anchored to the bottom of the page */}
        {items.length > 0 && (
          <div className="mt-auto pt-4">
            <button
              onClick={() => setAddModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-bg-border rounded-2xl text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all text-sm font-medium"
            >
              <Plus size={16} /> Add another item
            </button>
          </div>
        )}
      </main>

      {/* ── Add item type picker modal ───────────────── */}
      {addModal && (
        <Modal title="Add item" onClose={() => setAddModal(false)} size="lg">
          <p className="text-text-muted text-xs mb-3">Choose the type of content to add</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {ITEM_TYPE_OPTIONS.map(({ type, label, desc, icon: Icon, color, bg }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleAddItem(type)}
                className="flex items-start gap-2.5 p-2.5 bg-bg-elevated hover:bg-bg-hover border border-bg-border hover:border-accent/30 rounded-lg text-left transition-all"
              >
                <div className={`w-7 h-7 shrink-0 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary leading-tight">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5 leading-snug">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Unsaved changes navigation guard ─────────── */}
      {navBlocker.state === 'blocked' && (
        <Modal
          title="Leave without saving?"
          onClose={() => navBlocker.reset()}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => navBlocker.reset()}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => navBlocker.proceed()}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Leave anyway
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm leading-relaxed">
            You have {dirtyItems.size} {dirtyItems.size === 1 ? 'item' : 'items'} with unsaved changes.
            Leaving now may discard edits that have not been saved yet.
          </p>
        </Modal>
      )}

      {bulkDeleteConfirm && (
        <Modal
          title={`Move ${bulkDeleteConfirm.length} items to bin?`}
          onClose={() => setBulkDeleteConfirm(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(null)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkRemove.mutate(bulkDeleteConfirm, {
                    onSuccess: () => {
                      toast.success(`Moved ${bulkDeleteConfirm.length} items to bin`)
                      setBulkDeleteConfirm(null)
                      exitSelectMode()
                    },
                    onError: () => toast.error("Couldn't delete items."),
                  })
                }}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Move to bin
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm leading-relaxed">
            Selected items will be moved to the recycle bin. You can restore them later.
          </p>
        </Modal>
      )}

      {moveRequest && (
        <Modal
          title={`Move ${moveRequest.ids.length} ${moveRequest.ids.length === 1 ? 'item' : 'items'} to space`}
          onClose={() => setMoveRequest(null)}
        >
          {destinationSpaces.length === 0 ? (
            <div className="space-y-4">
              <p className="text-text-secondary text-sm leading-relaxed">
                Create another space first, then you can move items into it.
              </p>
              <button
                type="button"
                onClick={() => setMoveRequest(null)}
                className="w-full px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {destinationSpaces.map(candidate => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleMoveItems(candidate.id)}
                  disabled={move.isPending}
                  className="w-full rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base px-4 py-3 text-left transition-colors disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-text-primary truncate">{candidate.name}</span>
                  {candidate.description && (
                    <span className="mt-0.5 block text-xs text-text-muted truncate">{candidate.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Delete item confirmation modal ───────────── */}
      {deleteConfirm && (
        <Modal
          title="Move to recycle bin?"
          onClose={() => setDeleteConfirm(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  remove.mutate(deleteConfirm, {
                    onSuccess: () => toast.success('Item moved to recycle bin'),
                    onError: () => toast.error("Couldn't delete item."),
                  })
                  setDeleteConfirm(null)
                }}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Move to bin
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm leading-relaxed">
            This item will be moved to the recycle bin. You can restore it later or permanently delete it from there.
          </p>
        </Modal>
      )}
    </div>
  )
}
