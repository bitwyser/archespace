/**
 * RichTextEditor - WYSIWYG editor for the Rich Text item type.
 *
 * A contenteditable surface with a small toolbar: bold, italic, underline,
 * font-size increase / decrease, and clear formatting. Content is stored as
 * sanitised HTML ({ html }).
 *
 * The toolbar is rendered separately (RichTextToolbar) so SpaceItem can place
 * it on the tags row, always visible. It drives the editor through an imperative
 * handle exposed here (exec / changeFont / focus). Toolbar buttons preserve the
 * editor selection by preventing default on mousedown, so they work even though
 * they live outside this component's DOM.
 *
 * The contenteditable is uncontrolled: its initial HTML is set once on mount
 * (React never re-renders the innerHTML from state, which would fight the
 * cursor). SpaceItem remounts the editor via a key when content changes
 * externally, so mount-time initialisation is enough.
 */

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Bold, Italic, Underline, AArrowUp, AArrowDown, RemoveFormatting } from 'lucide-react'
import { sanitizeRichHtml } from '../../lib/sanitizeHtml'

// Font sizes map to the legacy execCommand('fontSize') scale (1-7).
const MIN_FONT = 1
const MAX_FONT = 7
const DEFAULT_FONT = 3

/**
 * @param {{ content: { html: string }, onChange: Function }} props
 */
const RichTextEditor = forwardRef(function RichTextEditor({ content, onChange }, ref) {
  const el = useRef(null)
  const fontSize = useRef(DEFAULT_FONT)
  const initial = content?.html || ''

  // Initialise the editable surface once, from the incoming content.
  useEffect(() => {
    const node = el.current
    if (node && node.innerHTML !== initial) node.innerHTML = sanitizeRichHtml(initial)
    // Semantic tags (b/i/u) rather than inline styles - easier to sanitise.
    try { document.execCommand('styleWithCSS', false, false) } catch { /* older engines */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = useCallback(() => {
    if (el.current) onChange({ html: sanitizeRichHtml(el.current.innerHTML) })
  }, [onChange])

  // Run a formatting command, then keep focus and persist the result.
  const exec = useCallback((command, value = null) => {
    if (!el.current) return
    el.current.focus()
    try { document.execCommand('styleWithCSS', false, false) } catch { /* noop */ }
    document.execCommand(command, false, value)
    emit()
  }, [emit])

  // Font size steps the whole content when nothing is selected (so the buttons
  // work without a selection), or just the selected text when there is one.
  const changeFont = useCallback((delta) => {
    const node = el.current
    if (!node) return
    node.focus()
    const sel = window.getSelection()
    const collapsed = !sel || sel.rangeCount === 0 || sel.isCollapsed
    const selectAll = collapsed && node.childNodes.length > 0
    if (selectAll) {
      const range = document.createRange()
      range.selectNodeContents(node)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    fontSize.current = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize.current + delta))
    try { document.execCommand('styleWithCSS', false, false) } catch { /* noop */ }
    document.execCommand('fontSize', false, String(fontSize.current))
    // Restore a collapsed caret at the end so the content isn't left selected.
    if (selectAll) {
      const end = document.createRange()
      end.selectNodeContents(node)
      end.collapse(false)
      sel.removeAllRanges()
      sel.addRange(end)
    }
    emit()
  }, [emit])

  useImperativeHandle(ref, () => ({
    exec,
    changeFont,
    focus: () => el.current?.focus(),
  }), [exec, changeFont])

  // Intercept Ctrl/Cmd+B / I / U so they route through exec() (semantic tags +
  // persist) rather than the browser's default styleWithCSS behaviour.
  const handleKeyDown = useCallback((e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const command = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]
    if (!command) return
    e.preventDefault()
    exec(command)
  }, [exec])

  // Paste as plain text so external formatting can't smuggle unsafe markup;
  // the toolbar is the only way to add formatting.
  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    document.execCommand('insertText', false, text)
    emit()
  }, [emit])

  return (
    <div
      ref={el}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Rich text content"
      data-placeholder="Start writing…"
      onInput={emit}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className="rich-text-editor w-full bg-bg-sunken border border-bg-border rounded-xl px-4 py-3 text-sm text-text-content leading-relaxed min-h-[80px] focus:outline-none focus:border-accent transition-colors whitespace-pre-wrap break-words"
    />
  )
})

export default RichTextEditor

/**
 * Toolbar of formatting controls, rendered separately (e.g. on the tags row).
 * Drives the editor via its imperative handle.
 *
 * @param {{ editorRef: { current: { exec: Function, changeFont: Function } } }} props
 */
export function RichTextToolbar({ editorRef }) {
  const exec = (command) => editorRef.current?.exec(command)
  const changeFont = (delta) => editorRef.current?.changeFont(delta)
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarBtn icon={Bold} label="Bold" onClick={() => exec('bold')} />
      <ToolbarBtn icon={Italic} label="Italic" onClick={() => exec('italic')} />
      <ToolbarBtn icon={Underline} label="Underline" onClick={() => exec('underline')} />
      <span className="w-px h-5 bg-bg-border mx-1" />
      <ToolbarBtn icon={AArrowUp} label="Increase font size" onClick={() => changeFont(1)} />
      <ToolbarBtn icon={AArrowDown} label="Decrease font size" onClick={() => changeFont(-1)} />
      <span className="w-px h-5 bg-bg-border mx-1" />
      <ToolbarBtn icon={RemoveFormatting} label="Clear formatting" onClick={() => exec('removeFormat')} />
    </div>
  )
}

function ToolbarBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // mousedown, not click: fires before the editor's blur, so the selection
      // is preserved when the command runs.
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent-muted transition-colors"
    >
      <Icon size={16} />
    </button>
  )
}
