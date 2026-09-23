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

/**
 * The preset colour softened for use as a card accent bar - the full-saturation
 * hex reads as too intense on cards, so blend it toward the surface with an
 * alpha suffix. The colour picker keeps the vivid value for clear selection.
 *
 * @param {string} id   - preset id
 * @param {string} alpha - 2-digit hex alpha (default 'a6' ~65%)
 */
export function softColorValue(id, alpha = 'a6') {
  const preset = getColorPreset(id)
  return preset ? `${preset.value}${alpha}` : undefined
}

/**
 * A stable colour for a tag: the same tag name always maps to the same preset
 * colour (case-insensitively), so a tag reads consistently across spaces.
 * @param {string} tag
 * @returns {string} hex value
 */
export function tagColorValue(tag) {
  const key = (tag || '').trim().toLowerCase()
  if (!key) return SPACE_COLORS[0].value
  let sum = 0
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i)
  return SPACE_COLORS[sum % SPACE_COLORS.length].value
}

export function parseTags(raw) {
  if (Array.isArray(raw)) return raw.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean)
  return []
}
