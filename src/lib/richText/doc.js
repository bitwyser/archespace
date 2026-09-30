/**
 * doc.js - Helpers for Rich text content that don't need the editor (so
 * search, copy and PDF export stay light): reading the stored Tiptap JSON.
 *
 * Rich text content is `{ doc }` (Tiptap JSON). Items saved before the Tiptap
 * editor hold `{ html }` (the old Rich text) or are the old `markdown` type
 * with `{ text }`; they convert on first load (richTextMigration.js).
 */
import { richHtmlToPlainText } from '../sanitizeHtml'

export const EMPTY_RICH_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

/** True when `content` holds a Tiptap document (not an older format). */
export function isRichDoc(content) {
  return !!content && typeof content.doc === 'object' && content.doc?.type === 'doc'
}

/** True when a Rich text / Markdown item still needs converting. */
export function needsRichConversion(type, content) {
  if (type === 'markdown') return true
  return type === 'richtext' && !isRichDoc(content)
}

const BLOCKS = new Set([
  'paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem',
  'tableRow', 'horizontalRule',
])

/** End the current line (once, however deeply blocks nest). */
function lineBreak(out) {
  if (out.length && !out[out.length - 1].endsWith('\n')) out.push('\n')
}

/** Plain text of a Tiptap node: a line per block, tabs between table cells. */
function nodeText(node, out) {
  if (!node) return
  if (node.type === 'text') {
    out.push(node.text || '')
    return
  }
  if (node.type === 'hardBreak') {
    out.push('\n')
    return
  }
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    const cell = []
    for (const child of node.content || []) nodeText(child, cell)
    out.push(cell.join('').trim().replace(/\s*\n\s*/g, ' '), '\t')
    return
  }
  for (const child of node.content || []) nodeText(child, out)
  if (node.type === 'tableRow' && out[out.length - 1] === '\t') out.pop()
  if (BLOCKS.has(node.type)) lineBreak(out)
}

/** Plain text of Rich text content in any of its formats (for copy/search). */
export function richContentToPlainText(type, content) {
  const c = content || {}
  if (isRichDoc(c)) {
    const out = []
    nodeText(c.doc, out)
    return out.join('').replace(/\n{3,}/g, '\n\n').trim()
  }
  if (type === 'markdown') return c.text ?? ''
  return richHtmlToPlainText(c.html)
}
