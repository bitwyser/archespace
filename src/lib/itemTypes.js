import { AlignLeft, CheckSquare, List, ListOrdered, LayoutList, FileCode, KeyRound, Brush } from 'lucide-react'

/** Human-readable labels for each item type */
export const TYPE_LABELS = {
  textbox: 'Note',
  checkbox_list: 'Checklist',
  menu_list: 'List',
  numbered_list: 'Numbered List',
  card_list: 'Cards',
  markdown: 'Markdown',
  secret: 'Secret',
  draw: 'Drawing',
}

/** Colour scheme per item type (text, background, border) */
export const TYPE_STYLES = {
  textbox: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  checkbox_list: { text: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  menu_list: { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  numbered_list: { text: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/20' },
  card_list: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  markdown: { text: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20' },
  secret: { text: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20' },
  draw: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/20' },
}

/** Item type definitions for the "Add item" modal */
export const ITEM_TYPE_OPTIONS = [
  { type: 'textbox', label: 'Note', desc: 'Free-form plain text', icon: AlignLeft, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { type: 'markdown', label: 'Markdown', desc: 'Rich text with markdown formatting', icon: FileCode, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { type: 'menu_list', label: 'List', desc: 'Simple bullet list', icon: List, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { type: 'numbered_list', label: 'Numbered List', desc: 'Ordered list with numbering', icon: ListOrdered, color: 'text-pink-400', bg: 'bg-pink-400/10' },
  { type: 'checkbox_list', label: 'Checklist', desc: 'Items with checkboxes', icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-400/10' },
  { type: 'card_list', label: 'Cards', desc: 'Title + description pairs', icon: LayoutList, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { type: 'secret', label: 'Secret', desc: 'PIN-protected hidden text', icon: KeyRound, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  { type: 'draw', label: 'Drawing', desc: 'Freehand sketch or diagram', icon: Brush, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' },
]
