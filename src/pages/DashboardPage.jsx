/**
 * The signed-in home: a searchable, sortable grid or list of the user's spaces,
 * with create/edit/delete, pinning, and links to archive, bin, and settings.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Folder,
  Trash2, Archive, Command, CheckSquare, ListChecks, Settings, Lock, Menu, Keyboard, LogOut,
  LayoutGrid, List,
} from 'lucide-react'
import GlobalSearchResults from '../components/GlobalSearchResults'
import { useDragReorder } from '../hooks/useDragReorder'
import { useCommandPalette } from '../context/CommandPaletteCore'
import { MULTI_USER_ENABLED } from '../lib/appConfig'
import BulkSelectionBar from '../components/BulkSelectionBar'
import { BULK_ICONS } from '../components/BulkSelectionIcons'
import { useAuth } from '../context/AuthContextCore'
import { useEncryption } from '../context/EncryptionCore'
import { useToast } from '../context/ToastCore'
import { useRegisterPageActions } from '../context/PageActionsCore'
import { useSpaces } from '../hooks/useSpaces'
import { useRecycleBin } from '../hooks/useRecycleBin'
import { useArchive } from '../hooks/useArchive'
import { useSpaceStats } from '../hooks/useSpaceStats'
import { useGlobalSearchData } from '../hooks/useGlobalSearch'
import { filterGlobalSearch, searchOptionId, SEARCH_ITEM_DISPLAY_LIMIT } from '../lib/search'
import { Modal, ConfirmDialog } from '../components/ui/UI'
import { SortMenu } from '../components/ui/SortMenu'
import { SpaceModal } from '../components/space/SpaceModal'
import { SpaceCard } from '../components/space/SpaceCard'
import { usePersistedSort } from '../hooks/usePersistedSort'
import { sortEntities } from '../lib/sortEntities'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const { lock, isUnlocked } = useEncryption()
  const { toast } = useToast()
  const { openPalette } = useCommandPalette()
  const {
    data: spaces = [], isLoading, create, update, togglePin, remove, reorder,
    archive, duplicate, bulkRemove, bulkArchive, bulkSetPinned, bulkDuplicate,
  } = useSpaces()
  const { total: binTotal } = useRecycleBin()
  const { total: archiveTotal } = useArchive()
  const { data: stats = {} } = useSpaceStats()
  const { data: globalSearchData } = useGlobalSearchData()
  const navigate = useNavigate()
  const headerRef = useRef(null)
  const searchInputRef = useRef(null)
  const mobileSearchInputRef = useRef(null)

  // ── Local state ──
  const [modal, setModal] = useState(null) // { type: 'create' } | { type: 'edit', col } | null
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchActive, setSearchActive] = useState(-1)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('arche:spaces-view') === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })

  const changeViewMode = useCallback((mode) => {
    setViewMode(mode)
    try { localStorage.setItem('arche:spaces-view', mode) } catch { /* storage unavailable */ }
  }, [])

  // Grid is a round-robin masonry (2 columns, 3 on lg) so the sort order reads
  // left-to-right across the top row - pinned/newest spaces stay at the top.
  const [gridCols, setGridCols] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 3 : 2),
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => setGridCols(e.matches ? 3 : 2)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const [spaceSort, setSpaceSort] = usePersistedSort('arche-sort-spaces')

  const selectedCount = selectedIds.size
  const selectedSpaces = useMemo(
    () => spaces.filter(c => selectedIds.has(c.id)),
    [spaces, selectedIds]
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

  const focusMainSearch = useCallback(() => {
    setMobileMenuOpen(false)
    const isMobile = window.matchMedia('(max-width: 639px)').matches
    const ref = isMobile ? mobileSearchInputRef : searchInputRef
    setTimeout(() => ref.current?.focus(), 0)
  }, [])

  const pageActions = useMemo(() => ({
    onNewSpace: () => setModal({ type: 'create' }),
    onOpenSearch: () => focusMainSearch(),
    onEscape: () => {
      setModal(null)
      setDeleteConfirm(null)
      setMobileMenuOpen(false)
      setBulkDeleteConfirm(null)
      exitSelectMode()
    },
  }), [exitSelectMode, focusMainSearch])

  useRegisterPageActions(pageActions)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const handlePointerDown = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [mobileMenuOpen])

  // ── Derived state ──
  const globalMatches = useMemo(() => (
    filterGlobalSearch({
      spaces: globalSearchData?.spaces || [],
      items: globalSearchData?.items || [],
      itemMeta: globalSearchData?.itemMeta || {},
    }, search)
  ), [globalSearchData, search])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return spaces

    const matchedSpaceIds = new Set([
      ...globalMatches.spaces.map(c => c.id),
      ...globalMatches.items.map(i => i.space_id),
    ])
    return spaces.filter(c => matchedSpaceIds.has(c.id))
  }, [spaces, globalMatches, search])

  const sortedSpaces = useMemo(
    () => sortEntities(filtered, spaceSort, s => s.name),
    [filtered, spaceSort]
  )
  // Manual drag order only applies to the default sort.
  const reorderDisabled = !!search || selectMode || spaceSort !== 'default'

  const showSearchResults = search.trim().length > 0 && searchFocused

  const closeSearch = useCallback(() => {
    setSearchFocused(false)
    setSearch('')
    setSearchActive(-1)
  }, [])

  const goSpaceFromSearch = useCallback((spaceId) => {
    closeSearch()
    navigate(`/space/${spaceId}`)
  }, [closeSearch, navigate])

  const goItemFromSearch = useCallback((item) => {
    closeSearch()
    navigate(`/space/${item.space_id}`, { state: { focusItemId: item.id } })
  }, [closeSearch, navigate])

  // Flat, ordered list of visible results for keyboard nav - must match
  // GlobalSearchResults' render order (spaces, then capped items).
  const searchOptions = useMemo(() => [
    ...globalMatches.spaces.map(s => ({
      id: searchOptionId('space', s.id),
      run: () => goSpaceFromSearch(s.id),
    })),
    ...globalMatches.items.slice(0, SEARCH_ITEM_DISPLAY_LIMIT).map(i => ({
      id: searchOptionId('item', i.id),
      run: () => goItemFromSearch(i),
    })),
  ], [globalMatches, goSpaceFromSearch, goItemFromSearch])

  const searchActiveIndex = searchOptions.length === 0 ? -1 : Math.min(searchActive, searchOptions.length - 1)
  const activeOptionId = searchActiveIndex >= 0 ? searchOptions[searchActiveIndex].id : undefined

  const handleSearchKeyDown = useCallback((e) => {
    if (!showSearchResults || searchOptions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSearchActive(i => Math.min(i + 1, searchOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSearchActive(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && searchActiveIndex >= 0) {
      e.preventDefault()
      searchOptions[searchActiveIndex].run()
    } else if (e.key === 'Escape') {
      setSearch('')
      setSearchActive(-1)
    }
  }, [showSearchResults, searchOptions, searchActiveIndex])

  const {
    dragIndex, dragOverIndex,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  } = useDragReorder({
    disabled: reorderDisabled,
    onDrop: (fromIndex, toIndex) => {
      const fromId = sortedSpaces[fromIndex]?.id
      const toId = sortedSpaces[toIndex]?.id
      if (!fromId || !toId) return

      const reordered = [...spaces]
      const fromIdx = reordered.findIndex(c => c.id === fromId)
      const toIdx = reordered.findIndex(c => c.id === toId)
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)

      reorder.mutate(reordered, {
        onError: () => toast.error("Couldn't reorder spaces."),
      })
    },
  })

  const renderSpaceCard = (col, index) => (
    <SpaceCard
      key={col.id}
      col={col}
      index={index}
      search={search}
      stats={stats}
      layout="grid"
      reorderDisabled={reorderDisabled}
      selectMode={selectMode}
      selected={selectedIds.has(col.id)}
      onToggleSelect={() => toggleSelected(col.id)}
      dragIndex={dragIndex}
      dragOverIndex={dragOverIndex}
      handleDragStart={handleDragStart}
      handleDragOver={handleDragOver}
      handleDrop={handleDrop}
      handleDragEnd={handleDragEnd}
      navigate={navigate}
      togglePin={togglePin}
      setModal={setModal}
      setDeleteConfirm={setDeleteConfirm}
      onDuplicate={(id) => duplicate.mutate(id, {
        onSuccess: () => toast.success('Space duplicated'),
        onError: () => toast.error("Couldn't duplicate the space."),
      })}
      onArchive={(id) => archive.mutate(id, {
        onSuccess: () => toast.success('Space archived'),
        onError: () => toast.error("Couldn't archive the space."),
      })}
    />
  )

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Header (mobile only) ──────────────────────── */}
      <header ref={headerRef} className="sm:hidden sticky top-0 z-20 glass">
        <div className="w-full px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="shrink-0">
            <span className="text-lg font-semibold tracking-widest text-text-primary">ArcheSpace</span>
            {MULTI_USER_ENABLED && user?.email && (
              <p className="text-[10px] text-text-muted truncate max-w-[140px]">{user.email}</p>
            )}
          </div>

          {/* Actions - mobile: lock + ordered menu (search is the bar below) */}
          <div className="flex sm:hidden items-center gap-2">
            {isUnlocked && (
              <button
                type="button"
                onClick={() => {
                  lock()
                  toast.info('Vault locked')
                }}
                className="p-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary transition-all"
                title="Lock vault"
                aria-label="Lock vault"
              >
                <Lock size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              className="p-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary transition-all"
              title="More"
              aria-expanded={mobileMenuOpen}
              aria-label="More actions"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-bg-border bg-bg-surface px-4 py-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { openPalette(); setMobileMenuOpen(false) }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
            >
              <Command size={16} />
              Commands
            </button>
            <button
              type="button"
              onClick={() => { window.dispatchEvent(new CustomEvent('arche:open-shortcuts')); setMobileMenuOpen(false) }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
            >
              <Keyboard size={16} />
              Keyboard shortcuts
            </button>
            <button
              type="button"
              onClick={() => { navigate('/archive'); setMobileMenuOpen(false) }}
              className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
            >
              <Archive size={16} />
              Archive
              {archiveTotal > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1">
                  {archiveTotal > 99 ? '99+' : archiveTotal}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { navigate('/recycle-bin'); setMobileMenuOpen(false) }}
              className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
            >
              <Trash2 size={16} />
              Recycle bin
              {binTotal > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold px-1">
                  {binTotal > 99 ? '99+' : binTotal}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); setConfirmSignOut(true) }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-danger/10 hover:border-danger/30 text-text-secondary hover:text-danger transition-all text-sm font-medium"
            >
              <LogOut size={16} />
              Sign out
            </button>
            <button
              type="button"
              onClick={() => { navigate('/settings'); setMobileMenuOpen(false) }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-bg-border hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
            >
              <Settings size={16} />
              Settings
            </button>
          </div>
        )}
      </header>

      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need your login password and vault PIN to sign back in."
          confirmLabel="Sign out"
          destructive
          onConfirm={() => { setConfirmSignOut(false); signOut(); toast.info('Signed out') }}
          onClose={() => setConfirmSignOut(false)}
        />
      )}

      {/* ── Main content ──────────────────────────────── */}
      <main className="px-4 sm:px-6 py-6">
        {/* Search - desktop */}
        <div className="hidden sm:block max-w-xl mb-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchActive(-1) }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-expanded={showSearchResults}
              aria-controls="global-search-listbox"
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              className="w-full bg-bg-elevated border border-bg-border rounded-xl pl-9 pr-12 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono">/</kbd>
            {showSearchResults && (
              <GlobalSearchResults
                search={search}
                globalMatches={globalMatches}
                itemMeta={globalSearchData?.itemMeta}
                truncated={globalSearchData?.truncated}
                onSelectSpace={goSpaceFromSearch}
                onSelectItem={goItemFromSearch}
                activeOptionId={activeOptionId}
                listboxId="global-search-listbox"
                className="absolute top-full mt-2 left-0 right-0 z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-bg-border bg-bg-surface shadow-2xl p-3 space-y-3"
              />
            )}
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchActive(-1) }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-expanded={showSearchResults}
              aria-controls="global-search-listbox-mobile"
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              className="w-full bg-bg-surface border border-bg-border rounded-xl pl-9 pr-3 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {showSearchResults && (
              <GlobalSearchResults
                search={search}
                globalMatches={globalMatches}
                itemMeta={globalSearchData?.itemMeta}
                truncated={globalSearchData?.truncated}
                onSelectSpace={goSpaceFromSearch}
                onSelectItem={goItemFromSearch}
                activeOptionId={activeOptionId}
                listboxId="global-search-listbox-mobile"
                className="mt-2 z-30 max-h-[50vh] overflow-y-auto rounded-2xl border border-bg-border bg-bg-surface shadow-2xl p-3 space-y-3"
              />
            )}
          </div>
        </div>

        {/* Page heading */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Spaces</h2>
            <p className="text-text-muted text-sm mt-0.5">
              {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && !selectMode && (
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
            {selectMode && filtered.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(filtered.map(c => c.id)))}
                title="Select all"
                aria-label="Select all"
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated text-sm font-medium transition-all"
              >
                <ListChecks size={14} />
                <span className="hidden sm:inline">Select all</span>
              </button>
            )}
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                title={selectMode ? 'Done' : 'Select'}
                className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border text-sm font-medium transition-all ${
                  selectMode
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                }`}
              >
                <CheckSquare size={14} />
                <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
              </button>
            )}
            {spaces.length > 1 && !selectMode && (
              <SortMenu value={spaceSort} onChange={setSpaceSort} />
            )}
            <button
              type="button"
              onClick={() => setModal({ type: 'create' })}
              title="New space"
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white rounded-xl p-2 sm:px-3 sm:py-2 text-sm font-semibold transition-colors shadow-lg shadow-accent/20"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">New space</span>
            </button>
          </div>
        </div>

        {/* Spaces grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-bg-border rounded-2xl p-4 bg-bg-surface animate-pulse">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-5 bg-bg-elevated rounded w-2/3"></div>
                    <div className="h-3 bg-bg-elevated rounded w-full"></div>
                    <div className="h-3 bg-bg-elevated rounded w-4/5"></div>
                  </div>
                  <div className="w-4 h-4 bg-bg-elevated rounded shrink-0"></div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-bg-border">
                  <div className="w-16 h-3 bg-bg-elevated rounded"></div>
                  <div className="flex gap-1">
                    <div className="w-12 h-6 bg-bg-elevated rounded"></div>
                    <div className="w-12 h-6 bg-bg-elevated rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-bg-border flex items-center justify-center mx-auto mb-4">
              <Folder size={24} className="text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium">{search ? 'No spaces match your search' : 'No spaces yet'}</p>
            <p className="text-text-muted text-sm mt-1">{search ? 'Try a different search term' : 'Create your first space to get started'}</p>
            {!search && (
              <button
                onClick={() => setModal({ type: 'create' })}
                className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Plus size={16} /> New space
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="flex items-start gap-2 sm:gap-3 pb-32">
                {Array.from({ length: gridCols }, (_, col) => (
                  <div key={col} className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-3">
                    {sortedSpaces
                      .map((space, index) => ({ space, index }))
                      .filter(({ index }) => index % gridCols === col)
                      .map(({ space, index }) => renderSpaceCard(space, index))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 pb-32 max-w-[52rem] mx-auto">
                {sortedSpaces.map((space, index) => renderSpaceCard(space, index))}
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
                  onClick: async () => {
                    try {
                      await bulkSetPinned.mutateAsync({ ids: [...selectedIds], pinned: true })
                      toast.success(`Pinned ${selectedCount} spaces`)
                      exitSelectMode()
                    } catch { toast.error("Couldn't pin the space.") }
                  },
                },
                {
                  id: 'unpin',
                  label: 'Unpin',
                  icon: BULK_ICONS.unpin,
                  onClick: async () => {
                    try {
                      await bulkSetPinned.mutateAsync({ ids: [...selectedIds], pinned: false })
                      toast.success('Unpinned spaces')
                      exitSelectMode()
                    } catch { toast.error("Couldn't unpin the space.") }
                  },
                },
                {
                  id: 'duplicate',
                  label: 'Duplicate',
                  icon: BULK_ICONS.copy,
                  onClick: async () => {
                    try {
                      await bulkDuplicate.mutateAsync(selectedSpaces)
                      toast.success(`Duplicated ${selectedCount} spaces`)
                      exitSelectMode()
                    } catch { toast.error("Couldn't duplicate the space.") }
                  },
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: BULK_ICONS.archive,
                  onClick: async () => {
                    try {
                      await bulkArchive.mutateAsync([...selectedIds])
                      toast.success(`Archived ${selectedCount} spaces`)
                      exitSelectMode()
                    } catch { toast.error("Couldn't archive the space.") }
                  },
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  icon: BULK_ICONS.trash,
                  variant: 'danger',
                  onClick: () => setBulkDeleteConfirm([...selectedIds]),
                },
              ]}
            />
          </>
        )}
      </main>

      {/* ── Modals ────────────────────────────────────── */}
      {modal?.type === 'create' && (
        <SpaceModal
          onSave={({ name, description, color, tags }) => {
            create.mutate({ name, description, color, tags }, {
              onSuccess: () => toast.success('Space created'),
              onError: () => toast.error("Couldn't create space.")
            })
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <SpaceModal
          initial={modal.col}
          onSave={({ name, description, color, tags }) => {
            update.mutate({ id: modal.col.id, name, description, color, tags }, {
              onSuccess: () => toast.success('Space updated'),
              onError: () => toast.error("Couldn't update space.")
            })
          }}
          onClose={() => setModal(null)}
        />
      )}
      {bulkDeleteConfirm && (
        <Modal
          title={`Move ${bulkDeleteConfirm.length} spaces to recycle bin?`}
          onClose={() => setBulkDeleteConfirm(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(null)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary rounded-xl border border-bg-border hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkRemove.mutate(bulkDeleteConfirm, {
                    onSuccess: () => {
                      toast.success(`Moved ${bulkDeleteConfirm.length} spaces to recycle bin`)
                      setBulkDeleteConfirm(null)
                      exitSelectMode()
                    },
                    onError: () => toast.error("Couldn't delete the space."),
                  })
                }}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Move to recycle bin
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm">All items inside these spaces go to the bin as well.</p>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          title="Move space to recycle bin?"
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
                    onSuccess: () => toast.success('Space moved to recycle bin'),
                    onError: () => toast.error("Couldn't delete space.")
                  })
                  setDeleteConfirm(null)
                }}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Move to recycle bin
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm leading-relaxed">
            This space and all its items will be moved to the recycle bin.
            You can restore them later or permanently delete them from there.
          </p>
        </Modal>
      )}
    </div>
  )
}
