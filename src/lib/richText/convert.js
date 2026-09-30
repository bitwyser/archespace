/**
 * convert.js - Turn older Rich text formats into Tiptap JSON: the old Rich
 * text HTML (`{ html }`) and the old Markdown type (`{ text }`). Runs the same
 * editor configuration headlessly, so what it produces is exactly what the
 * editor would. Imported lazily (it pulls in the editor).
 */
import { Editor } from '@tiptap/core'
import { richTextExtensions } from './extensions'
import { isRichDoc, EMPTY_RICH_DOC } from './doc'
import { sanitizeRichHtml } from '../sanitizeHtml'

/**
 * Tiptap JSON for an item's content, whatever format it's in.
 * @param {string} type 'richtext' | 'markdown'
 * @param {object} content
 * @returns {object} a Tiptap doc
 */
export function toRichDoc(type, content) {
  const c = content || {}
  if (isRichDoc(c)) return c.doc
  const source = type === 'markdown' ? (c.text ?? '') : sanitizeRichHtml(c.html ?? '')
  if (!source.trim()) return EMPTY_RICH_DOC
  const editor = new Editor({
    extensions: richTextExtensions(),
    content: source,
    contentType: type === 'markdown' ? 'markdown' : 'html',
  })
  try {
    return editor.getJSON()
  } finally {
    editor.destroy()
  }
}
