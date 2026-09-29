/**
 * useItemBoard.js - Item handling shared by a space page and the dashboard.
 *
 * Wraps useSpaceItems for one space (or the dashboard's items, `spaceId ===
 * null`) with everything a page of item cards needs: stable, memo-friendly card
 * callbacks, unsaved-edit tracking (with the leave-page guard), per-card
 * collapse, the add / delete / move dialogs' state, and the brief highlight of
 * an item opened from global search. Render the dialogs with ItemBoardModals.
 *
 * Selection stays with the page, since the dashboard selects spaces and items
 * together while a space page selects items only.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useBlocker, useLocation } from 'react-router-dom'
import { useSpaceItems } from './useSpaceItems'
import { useToast } from '../context/ToastCore'
import { ITEM_TYPE_OPTIONS } from '../lib/itemTypes'

export function useItemBoard(spaceId) {
  const location = useLocation()
  const { toast } = useToast()
  const itemsApi = useSpaceItems(spaceId)
  const { data: items = [], isLoading } = itemsApi
  const { update, togglePin, toggleStar, setTags, duplicate, archive, create, move } = itemsApi

  // ── Dialog + card state ──
  const [addModal, setAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null)
  const [moveRequest, setMoveRequest] = useState(null)
  const [dirtyItems, setDirtyItems] = useState(new Set())
  // Items the user has collapsed to header-only via the card chevron.
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const [flashItemId, setFlashItemId] = useState(null)

  const openAddItem = useCallback(() => setAddModal(true), [])

  const closeAll = useCallback(() => {
    setAddModal(false)
    setDeleteConfirm(null)
    setBulkDeleteConfirm(null)
    setMoveRequest(null)
  }, [])

  const setItemCollapsed = useCallback((id, collapsed) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (collapsed) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const setManyCollapsed = useCallback((ids, collapsed) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => (collapsed ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

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
  const toastRef = useRef(toast)
  useEffect(() => {
    dirtyItemsRef.current = dirtyItems
    toastRef.current = toast
  })

  const hasDirty = useCallback(
    (ids) => ids.some(itemId => dirtyItemsRef.current.has(itemId)),
    []
  )

  const updateAsync = update.mutateAsync
  const togglePinMutate = togglePin.mutate
  const toggleStarMutate = toggleStar.mutate
  const duplicateMutate = duplicate.mutate
  const archiveMutate = archive.mutate

  const handleItemUpdate = useCallback((payload) => updateAsync(payload), [updateAsync])
  const handleSetTags = useCallback((itemId, tags) => setTags.mutate({ id: itemId, tags }), [setTags])
  const handleTogglePin = useCallback(
    (itemId, pinned) => togglePinMutate({ id: itemId, pinned }),
    [togglePinMutate]
  )
  const handleToggleStar = useCallback(
    (itemId, starred) => toggleStarMutate({ id: itemId, starred }, {
      onSuccess: () => toastRef.current.success(starred ? 'Removed from Starred' : 'Added to Starred'),
      onError: () => toastRef.current.error("Couldn't update the star."),
    }),
    [toggleStarMutate]
  )
  const handleDuplicateItem = useCallback((it) => duplicateMutate(it, {
    onSuccess: () => toastRef.current.success('Item duplicated'),
    onError: () => toastRef.current.error("Couldn't duplicate the item."),
  }), [duplicateMutate])
  const handleArchiveItem = useCallback((itemId) => archiveMutate(itemId, {
    onSuccess: () => toastRef.current.success('Item archived'),
    onError: () => toastRef.current.error("Couldn't archive the item."),
  }), [archiveMutate])
  const openMoveItems = useCallback((ids, onDone) => {
    if (!ids?.length) return
    if (ids.some(itemId => dirtyItemsRef.current.has(itemId))) {
      toastRef.current.error('Save or discard unsaved changes before moving items')
      return
    }
    setMoveRequest({ ids, onDone })
  }, [])
  const handleMoveOne = useCallback((itemId) => openMoveItems([itemId]), [openMoveItems])

  /** Ask to move `ids` to the bin; `onDone` runs after they're moved. */
  const requestBulkDelete = useCallback((ids, onDone) => {
    if (ids.some(itemId => dirtyItemsRef.current.has(itemId))) {
      toastRef.current.error('Save or discard unsaved changes first')
      return
    }
    setBulkDeleteConfirm({ ids, onDone })
  }, [])

  // Props every SpaceItem card on the page shares (all stable identities).
  const cardProps = useMemo(() => ({
    onCollapsedChange: setItemCollapsed,
    onUpdate: handleItemUpdate,
    onSetTags: handleSetTags,
    onTogglePin: handleTogglePin,
    onToggleStar: handleToggleStar,
    onDelete: setDeleteConfirm,
    onDuplicate: handleDuplicateItem,
    onMove: handleMoveOne,
    onArchive: handleArchiveItem,
    onDirtyChange: handleDirtyChange,
  }), [
    setItemCollapsed, handleItemUpdate, handleSetTags, handleTogglePin, handleToggleStar,
    handleDuplicateItem, handleMoveOne, handleArchiveItem, handleDirtyChange,
  ])

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
  const handleAddItem = useCallback(async (type) => {
    setAddModal(false)
    try {
      await create.mutateAsync({ type, title: '' })
      toastRef.current.success(`${ITEM_TYPE_OPTIONS.find(t => t.type === type)?.label || 'Item'} added`)
    } catch {
      toastRef.current.error("Couldn't add item.")
    }
  }, [create])

  /** Move the pending items to a space, or to the dashboard for `null`. */
  const handleMoveItems = useCallback(async (targetSpaceId, targetName) => {
    if (!moveRequest?.ids?.length) return
    try {
      await move.mutateAsync({ ids: moveRequest.ids, targetSpaceId })
      const movedCount = moveRequest.ids.length
      toastRef.current.success(`Moved ${movedCount} ${movedCount === 1 ? 'item' : 'items'} to ${targetName}`)
      moveRequest.onDone?.()
      setMoveRequest(null)
    } catch {
      toastRef.current.error("Couldn't move items.")
    }
  }, [move, moveRequest])

  return {
    spaceId,
    items,
    isLoading,
    api: itemsApi,
    dirtyItems,
    hasDirty,
    collapsedIds,
    setManyCollapsed,
    flashItemId,
    cardProps,
    openAddItem,
    openMoveItems,
    requestBulkDelete,
    closeAll,
    // Dialog state, rendered by ItemBoardModals.
    addModal,
    setAddModal,
    handleAddItem,
    deleteConfirm,
    setDeleteConfirm,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    moveRequest,
    setMoveRequest,
    handleMoveItems,
    navBlocker,
  }
}
