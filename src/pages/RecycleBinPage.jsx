/**
 * RecycleBinPage.jsx - Manage soft-deleted items and spaces.
 */
import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Trash2, RotateCcw, Folder, LayoutList, AlertTriangle, CheckSquare, ListChecks,
} from 'lucide-react'
import { useRecycleBin } from '../hooks/useRecycleBin'
import { useDualEntitySelection } from '../hooks/useDualEntitySelection'
import { useToast } from '../context/ToastCore'
import BulkSelectionBar from '../components/BulkSelectionBar'
import { BULK_ICONS } from '../components/BulkSelectionIcons'
import SelectableRow from '../components/SelectableRow'
import { Spinner, Modal } from '../components/ui/UI'
import { TYPE_LABELS } from '../lib/itemTypes'
import { timeAgo } from '../lib/timeAgo'

export default function RecycleBinPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    data, isLoading, restoreSpace, purgeSpace, restoreItem, purgeItem,
    bulkRestoreSpaces, bulkRestoreItems, bulkPurgeSpaces, bulkPurgeItems,
    emptyBin, total,
  } = useRecycleBin()

  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(null)
  const [confirmBulkPurge, setConfirmBulkPurge] = useState(false)

  const spaces = data?.spaces || []
  const items = data?.items || []

  const {
    selectMode, setSelectMode, selectedSpaceIds, selectedItemIds,
    selectableTotal, selectedCount, exitSelectMode, selectAll, toggleSpace, toggleItem,
  } = useDualEntitySelection(spaces, items)

  const runBulkRestore = useCallback(async () => {
    const colIds = [...selectedSpaceIds]
    const itemIds = [...selectedItemIds]
    const count = colIds.length + itemIds.length
    if (!count) return
    try {
      if (colIds.length) await bulkRestoreSpaces.mutateAsync(colIds)
      if (itemIds.length) await bulkRestoreItems.mutateAsync(itemIds)
      toast.success(`Restored ${count} ${count === 1 ? 'item' : 'items'}`)
      exitSelectMode()
    } catch {
      toast.error("Couldn't restore selection.")
    }
  }, [selectedSpaceIds, selectedItemIds, bulkRestoreSpaces, bulkRestoreItems, exitSelectMode, toast])

  const runBulkPurge = useCallback(async () => {
    const colIds = [...selectedSpaceIds]
    const itemIds = [...selectedItemIds]
    const count = colIds.length + itemIds.length
    try {
      if (itemIds.length) await bulkPurgeItems.mutateAsync(itemIds)
      if (colIds.length) await bulkPurgeSpaces.mutateAsync(colIds)
      toast.success(`Permanently deleted ${count} ${count === 1 ? 'item' : 'items'}`)
      setConfirmBulkPurge(false)
      exitSelectMode()
    } catch {
      toast.error("Couldn't delete selection.")
    }
  }, [selectedSpaceIds, selectedItemIds, bulkPurgeSpaces, bulkPurgeItems, exitSelectMode, toast])

  const bulkActions = useMemo(() => [
    {
      id: 'restore',
      label: 'Restore',
      icon: BULK_ICONS.restore,
      onClick: runBulkRestore,
    },
    {
      id: 'purge',
      label: 'Delete forever',
      icon: BULK_ICONS.trash,
      variant: 'danger',
      onClick: () => setConfirmBulkPurge(true),
    },
  ], [runBulkRestore])

  const handleEmptyBin = async () => {
    try {
      await emptyBin.mutateAsync()
      toast.success('Recycle bin emptied')
      setConfirmEmpty(false)
      exitSelectMode()
    } catch {
      toast.error("Couldn't empty recycle bin.")
    }
  }

  const handlePurge = async () => {
    if (!confirmPurge) return
    try {
      if (confirmPurge.type === 'space') {
        await purgeSpace.mutateAsync(confirmPurge.id)
      } else {
        await purgeItem.mutateAsync(confirmPurge.id)
      }
      toast.success('Permanently deleted')
      setConfirmPurge(null)
    } catch {
      toast.error("Couldn't delete permanently.")
    }
  }

  return (
    <div className="min-h-screen bg-bg-base pb-32">
      <header className="sticky top-0 z-20 glass">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-text-primary">Recycle Bin</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {total} {total === 1 ? 'item' : 'items'} - deleted items are kept here until permanently removed
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectMode && selectableTotal > 0 && (
              <button
                type="button"
                onClick={selectAll}
                title="Select all"
                aria-label="Select all"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
              >
                <ListChecks size={14} />
                <span className="hidden sm:inline">Select all</span>
              </button>
            )}
            {selectableTotal > 0 && (
              <button
                type="button"
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  selectMode
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                <CheckSquare size={14} />
                <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
              </button>
            )}
            {total > 0 && !selectMode && (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-text-secondary transition-all text-sm font-medium"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Empty bin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : total === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-bg-border flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium">Recycle bin is empty</p>
            <p className="text-text-muted text-sm mt-1">Deleted spaces and items will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {spaces.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Folder size={14} className="text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Spaces</h2>
                  <span className="text-xs text-text-muted">({spaces.length})</span>
                </div>
                <div className="space-y-2">
                  {spaces.map(col => (
                    <SelectableRow
                      key={col.id}
                      selectMode={selectMode}
                      selected={selectedSpaceIds.has(col.id)}
                      onToggle={() => toggleSpace(col.id)}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={() => restoreSpace.mutate(col.id, {
                              onSuccess: () => toast.success('Space restored'),
                              onError: () => toast.error("Couldn't restore space."),
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-success/10 hover:border-success/30 hover:text-success text-text-secondary transition-all text-xs font-medium"
                          >
                            <RotateCcw size={14} /> Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPurge({ type: 'space', id: col.id, name: col.name })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-text-secondary transition-all text-xs font-medium"
                          >
                            <Trash2 size={14} /> Delete forever
                          </button>
                        </>
                      }
                    >
                      <p className="text-sm font-semibold text-text-primary truncate">{col.name}</p>
                      {col.description && (
                        <p className="text-xs text-text-muted truncate mt-0.5">{col.description}</p>
                      )}
                      <p className="text-xs text-text-muted mt-1">Deleted {timeAgo(col.deleted_at)}</p>
                    </SelectableRow>
                  ))}
                </div>
              </section>
            )}

            {items.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <LayoutList size={14} className="text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Items</h2>
                  <span className="text-xs text-text-muted">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <SelectableRow
                      key={item.id}
                      selectMode={selectMode}
                      selected={selectedItemIds.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={() => restoreItem.mutate(item.id, {
                              onSuccess: () => toast.success('Item restored'),
                              onError: () => toast.error("Couldn't restore item."),
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-success/10 hover:border-success/30 hover:text-success text-text-secondary transition-all text-xs font-medium"
                          >
                            <RotateCcw size={14} /> Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPurge({ type: 'item', id: item.id, name: item.title || 'Untitled' })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-text-secondary transition-all text-xs font-medium"
                          >
                            <Trash2 size={14} /> Delete forever
                          </button>
                        </>
                      }
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md border border-bg-border">
                          {TYPE_LABELS[item.type]}
                        </span>
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {item.title || 'Untitled'}
                        </p>
                      </div>
                      <p className="text-xs text-text-muted mt-1">Deleted {timeAgo(item.deleted_at)}</p>
                    </SelectableRow>
                  ))}
                </div>
              </section>
            )}

            <BulkSelectionBar
              count={selectedCount}
              onClear={exitSelectMode}
              actions={bulkActions}
            />
          </div>
        )}
      </main>

      {confirmEmpty && (
        <Modal
          title="Empty recycle bin?"
          onClose={() => setConfirmEmpty(false)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmEmpty(false)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyBin}
                disabled={emptyBin.isPending}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {emptyBin.isPending && <Spinner size={14} />}
                Empty bin permanently
              </button>
            </div>
          }
        >
          <div className="flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-danger" />
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              This will permanently delete all <strong className="text-text-primary">{total} {total === 1 ? 'item' : 'items'}</strong> in the bin. This cannot be undone.
            </p>
          </div>
        </Modal>
      )}

      {confirmBulkPurge && (
        <Modal
          title={`Delete ${selectedCount} permanently?`}
          onClose={() => setConfirmBulkPurge(false)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmBulkPurge(false)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary rounded-xl border border-bg-border hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runBulkPurge}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Delete forever
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm">Selected items cannot be recovered after this.</p>
        </Modal>
      )}

      {confirmPurge && (
        <Modal
          title="Delete permanently?"
          onClose={() => setConfirmPurge(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmPurge(null)}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurge}
                className="px-4 py-2.5 text-sm font-semibold border border-transparent bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                Delete forever
              </button>
            </div>
          }
        >
          <p className="text-text-secondary text-sm leading-relaxed">
            <strong className="text-text-primary">&quot;{confirmPurge.name}&quot;</strong> will be permanently deleted and cannot be recovered.
          </p>
        </Modal>
      )}
    </div>
  )
}
