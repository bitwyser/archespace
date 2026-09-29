/**
 * ItemBoardModals.jsx - The item dialogs of a useItemBoard page: add item (type
 * picker), move to bin (one or many), move to another space or the dashboard,
 * and the leave-with-unsaved-edits guard.
 *
 * @param {{ board: ReturnType<import('../hooks/useItemBoard').useItemBoard>, spaces: Array }} props
 *   `spaces` are the possible move destinations (the board's own space is left out).
 */
import { LayoutDashboard } from 'lucide-react'
import { ITEM_TYPE_OPTIONS } from '../lib/itemTypes'
import { useToast } from '../context/ToastCore'
import { Modal } from './ui/UI'

export default function ItemBoardModals({ board, spaces }) {
  const { toast } = useToast()
  const {
    spaceId, api, dirtyItems,
    addModal, setAddModal, handleAddItem,
    deleteConfirm, setDeleteConfirm,
    bulkDeleteConfirm, setBulkDeleteConfirm,
    moveRequest, setMoveRequest, handleMoveItems,
    navBlocker,
  } = board
  const { remove, bulkRemove, move } = api

  // Inside a space, items can also move out to the dashboard.
  // A read-only space takes no new items, so it's never a destination.
  const destinationSpaces = spaces.filter(candidate => candidate.id !== spaceId && !candidate.read_only)
  const canMoveToDashboard = spaceId !== null

  return (
    <>
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
                className="flex items-start gap-2.5 p-2.5 bg-bg-card border border-bg-border hover:border-accent/30 rounded-lg text-left transition-all"
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
          title={`Move ${bulkDeleteConfirm.ids.length} items to bin?`}
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
                  bulkRemove.mutate(bulkDeleteConfirm.ids, {
                    onSuccess: () => {
                      toast.success(`Moved ${bulkDeleteConfirm.ids.length} items to bin`)
                      bulkDeleteConfirm.onDone?.()
                      setBulkDeleteConfirm(null)
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
          title={`Move ${moveRequest.ids.length} ${moveRequest.ids.length === 1 ? 'item' : 'items'}`}
          onClose={() => setMoveRequest(null)}
        >
          {destinationSpaces.length === 0 && !canMoveToDashboard ? (
            <div className="space-y-4">
              <p className="text-text-secondary text-sm leading-relaxed">
                Create a space first, then you can move items into it.
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
              {canMoveToDashboard && (
                <button
                  type="button"
                  onClick={() => handleMoveItems(null, 'Dashboard')}
                  disabled={move.isPending}
                  className="w-full flex items-center gap-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base px-4 py-3 text-left transition-colors disabled:opacity-50"
                >
                  <LayoutDashboard size={16} className="shrink-0 text-text-muted" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary truncate">Dashboard</span>
                    <span className="mt-0.5 block text-xs text-text-muted truncate">Outside any space</span>
                  </span>
                </button>
              )}
              {destinationSpaces.map(candidate => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleMoveItems(candidate.id, candidate.name || 'space')}
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
    </>
  )
}
