/**
 * spaceColors.js - Preset accent colors for spaces.
 */
export const SPACE_COLORS = [
  { id: 'violet', label: 'Violet', value: '#7c6af7' },
  { id: 'blue', label: 'Blue', value: '#60a5fa' },
  { id: 'green', label: 'Green', value: '#34d399' },
  { id: 'amber', label: 'Amber', value: '#fbbf24' },
  { id: 'rose', label: 'Rose', value: '#fb7185' },
  { id: 'slate', label: 'Slate', value: '#94a3b8' },
]

export function getColorPreset(id) {
  return SPACE_COLORS.find(c => c.id === id) || null
}

export function parseTags(raw) {
  if (Array.isArray(raw)) return raw.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean)
  return []
}
