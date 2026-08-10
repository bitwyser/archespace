/**
 * itemClipboard.js - Serialize an item's content to plain text for
 * copy-to-clipboard, per item type.
 *
 *   - textbox / markdown : the raw text as-is
 *   - list / checklist : one item per line, bullet-prefixed
 *   - numbered list : one item per line, numbered "1." "2." ...
 *   - cards : title, description on the next line, blank line between cards
 */

const BULLET = '• ' // "• "

function listToText(items, ordered = false) {
  return (items || [])
    .map(it => (it?.text ?? '').trim())
    .filter(text => text !== '')
    .map((text, i) => `${ordered ? `${i + 1}. ` : BULLET}${text}`)
    .join('\n')
}

function cardsToText(items) {
  return (items || [])
    .map(card => `${card?.title ?? ''}\n${card?.description ?? ''}`.trimEnd())
    .join('\n\n')
}

// Tab-separated so it pastes straight into a spreadsheet. The header row is
// included only when at least one column has a label.
function tableToText(content) {
  const columns = Array.isArray(content?.columns) ? content.columns : []
  const rows = Array.isArray(content?.rows) ? content.rows : []
  const lines = []
  if (columns.some(col => (col ?? '').trim() !== '')) lines.push(columns.join('\t'))
  for (const row of rows) lines.push((Array.isArray(row) ? row : []).join('\t'))
  return lines.join('\n')
}

/**
 * @param {{ type: string, content: object }} item
 * @returns {string}
 */
export function itemToClipboardText({ type, content } = {}) {
  const c = content || {}
  switch (type) {
    case 'textbox':
    case 'markdown':
      return c.text ?? ''
    case 'code':
      return c.code ?? ''
    case 'menu_list':
    case 'checkbox_list':
      return listToText(c.items)
    case 'numbered_list':
      return listToText(c.items, true)
    case 'card_list':
      return cardsToText(c.items)
    case 'table':
      return tableToText(c)
    default:
      return ''
  }
}
