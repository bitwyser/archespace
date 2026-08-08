/**
 * SpaceModal.jsx - Modal for creating or editing a space.
 */
import { useState } from 'react'
import { Ban } from 'lucide-react'
import { Modal, Spinner } from '../ui/UI'
import { SPACE_COLORS, parseTags } from '../../lib/spaceColors'

export function SpaceModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || null)
  const [tagsInput, setTagsInput] = useState(
    () => (Array.isArray(initial?.tags) ? initial.tags.join(', ') : '')
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim(),
      color,
      tags: parseTags(tagsInput.split(',').map(t => t.trim())),
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal title={initial ? 'Edit space' : 'New space'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
          <input
            autoFocus
            placeholder="Space name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Description <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            placeholder="What's this space for?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all bg-bg-elevated ${
                !color ? 'border-accent ring-2 ring-accent/30' : 'border-bg-border'
              }`}
              title="No color"
              aria-label="No color"
              aria-pressed={!color}
            >
              <Ban size={14} className="text-text-muted" />
            </button>
            {SPACE_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                style={{ backgroundColor: c.value }}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  color === c.id ? 'border-white ring-2 ring-accent/40 scale-110' : 'border-transparent'
                }`}
                title={c.label}
                aria-label={`${c.label} color`}
                aria-pressed={color === c.id}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Tags <span className="text-text-muted font-normal">(comma-separated)</span>
          </label>
          <input
            placeholder="work, personal, ideas"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm font-semibold bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Spinner size={14} />}
            {initial ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
