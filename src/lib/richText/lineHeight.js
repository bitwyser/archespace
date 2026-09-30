/**
 * lineHeight.js - Line spacing for Rich text paragraphs and headings, set on
 * the selected blocks (like a document editor). Stored as a `lineHeight`
 * attribute on each block; unset means the default (Normal, 1.5).
 */
import { Extension } from '@tiptap/core'

/** The choices offered in the toolbars (value null = Normal, the default). */
export const LINE_HEIGHTS = [
  { value: '1.2', label: 'Compact' },
  { value: null, label: 'Normal' },
  { value: '1.8', label: 'Relaxed' },
  { value: '2', label: 'Double' },
]

const ALLOWED = new Set(LINE_HEIGHTS.map(l => l.value).filter(Boolean))

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          // Only the offered values survive a paste or an import.
          parseHTML: (el) => (ALLOWED.has(el.style.lineHeight) ? el.style.lineHeight : null),
          renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
        },
      },
    }]
  },

  addCommands() {
    return {
      setLineHeight: (value) => ({ commands }) => {
        if (!value) return this.options.types.map(t => commands.resetAttributes(t, 'lineHeight')).some(Boolean)
        if (!ALLOWED.has(String(value))) return false
        return this.options.types.map(t => commands.updateAttributes(t, { lineHeight: String(value) })).some(Boolean)
      },
    }
  },
})
