/**
 * pdfExport.js - Export a space or a single item to PDF.
 *
 * Uses the browser's print dialog (destination "Save as PDF") from a hidden
 * same-origin iframe, so the export stays fully client-side, needs no PDF
 * dependency, and gets native text rendering and pagination. The document
 * title becomes the suggested file name.
 */
import { markdownToHtml } from '../components/editors/MarkdownPreview'
import { TYPE_LABELS } from './itemTypes'
import { strokeToSvgPath, DRAW_VIEW_W, DRAW_VIEW_H } from './drawing'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function listHtml(rows, ordered) {
  const tag = ordered ? 'ol' : 'ul'
  const inner = (rows || [])
    .filter(row => (row?.text ?? '').trim() !== '')
    .map(row => `<li>${escapeHtml(row.text)}</li>`)
    .join('')
  return inner ? `<${tag}>${inner}</${tag}>` : ''
}

function checklistHtml(rows) {
  const inner = (rows || [])
    .filter(row => (row?.text ?? '').trim() !== '')
    .map(row =>
      `<li class="${row.checked ? 'done' : ''}"><span class="box">${row.checked ? '☑' : '☐'}</span>${escapeHtml(row.text)}</li>`
    )
    .join('')
  return inner ? `<ul class="checklist">${inner}</ul>` : ''
}

function cardsHtml(cards) {
  return (cards || [])
    .filter(card => (card?.title ?? '').trim() !== '' || (card?.description ?? '').trim() !== '')
    .map(card =>
      `<div class="card">${card.title ? `<p class="card-title">${escapeHtml(card.title)}</p>` : ''}${
        card.description ? `<p class="card-desc">${escapeHtml(card.description)}</p>` : ''
      }</div>`
    )
    .join('')
}

function itemBodyHtml({ type, content }) {
  const c = content || {}
  switch (type) {
    case 'textbox':
      return c.text ? `<p class="plain">${escapeHtml(c.text)}</p>` : ''
    case 'markdown':
      return c.text ? `<div class="md">${markdownToHtml(c.text)}</div>` : ''
    case 'menu_list':
      return listHtml(c.items, false)
    case 'numbered_list':
      return listHtml(c.items, true)
    case 'checkbox_list':
      return checklistHtml(c.items)
    case 'card_list':
      return cardsHtml(c.items)
    case 'secret':
      return '<p class="empty">•••••• (hidden secret - reveal it in the app to view)</p>'
    case 'draw': {
      const strokes = Array.isArray(c.strokes) ? c.strokes : []
      if (!strokes.length) return '<p class="empty">Empty drawing</p>'
      const paths = strokes
        .map(s => `<path d="${strokeToSvgPath(s.points, s.size)}" fill="${s.color}"/>`)
        .join('')
      return `<svg viewBox="0 0 ${DRAW_VIEW_W} ${DRAW_VIEW_H}" width="100%" style="max-width:520px;border:1px solid #ddd;border-radius:6px;background:#fff">${paths}</svg>`
    }
    case 'table': {
      const columns = Array.isArray(c.columns) ? c.columns : []
      const rows = Array.isArray(c.rows) ? c.rows : []
      if (!columns.length && !rows.length) return '<p class="empty">Empty table</p>'
      const head = columns.some(col => (col ?? '').trim() !== '')
        ? `<thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>`
        : ''
      const body = `<tbody>${rows
        .map(row => `<tr>${(Array.isArray(row) ? row : []).map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
      return `<table class="tbl">${head}${body}</table>`
    }
    default:
      return ''
  }
}

function itemSectionHtml(item) {
  const title = escapeHtml(item.title || 'Untitled')
  const label = escapeHtml(TYPE_LABELS[item.type] || 'Item')
  const body = itemBodyHtml(item) || '<p class="empty">Empty</p>'
  return `<section class="item"><h2>${title} <span class="type">${label}</span></h2>${body}</section>`
}

function footerHtml() {
  return `<footer class="doc">Exported from Arche Space · ${escapeHtml(new Date().toLocaleDateString())}</footer>`
}

const PRINT_STYLES = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 12pt; line-height: 1.55; }
  header.doc { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .desc { margin: 0; color: #444; }
  .meta { margin: 6px 0 0; color: #666; font-size: 10pt; }
  .item { margin: 0 0 18px; break-inside: avoid; }
  .item h2 { font-size: 13.5pt; margin: 0 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .type { font-size: 9pt; font-weight: normal; color: #777; border: 1px solid #ccc; border-radius: 4px; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }
  .plain { margin: 0; white-space: pre-wrap; }
  .empty { color: #999; font-style: italic; }
  ul, ol { margin: 0; padding-left: 22px; }
  li { margin: 2px 0; }
  ul.checklist { list-style: none; padding-left: 2px; }
  ul.checklist .box { margin-right: 8px; }
  ul.checklist li.done { color: #777; text-decoration: line-through; }
  table.tbl { border-collapse: collapse; width: 100%; margin: 0; font-size: 10.5pt; }
  table.tbl th, table.tbl td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: top; }
  table.tbl th { background: #f5f5f5; font-weight: 600; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; margin: 0 0 8px; break-inside: avoid; }
  .card-title { margin: 0; font-weight: 600; }
  .card-desc { margin: 2px 0 0; color: #444; white-space: pre-wrap; }
  .md h1 { font-size: 15pt; margin: 10px 0 6px; }
  .md h2 { font-size: 13pt; margin: 10px 0 6px; border: 0; padding: 0; }
  .md h3 { font-size: 12pt; margin: 8px 0 4px; }
  .md p { margin: 0 0 8px; }
  .md ul, .md ol { margin: 0 0 8px; }
  .md pre { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 10pt; white-space: pre-wrap; overflow-wrap: anywhere; }
  .md code { background: #f5f5f5; border-radius: 3px; padding: 1px 4px; font-size: 10pt; }
  .md pre code { background: transparent; padding: 0; }
  .md blockquote { margin: 8px 0; padding-left: 10px; border-left: 3px solid #bbb; color: #555; }
  .md hr { border: 0; border-top: 1px solid #ddd; margin: 12px 0; }
  .md a { color: #111; }
  footer.doc { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 8px; color: #888; font-size: 9pt; }
`

/** Render the export HTML in a hidden iframe and open the print dialog. */
function openPrintDialog(title, bodyHtml) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>${bodyHtml}</body></html>`
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) {
      frame.remove()
      return
    }
    win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 500), { once: true })
    // Some browsers never fire afterprint for iframes - clean up eventually.
    setTimeout(() => frame.remove(), 120000)
    win.focus()
    win.print()
  }
  document.body.appendChild(frame)
}

/** Export a single item (uses its current local title/content). */
export function exportItemToPdf(item) {
  const title = (item?.title || '').trim() || 'Untitled'
  const label = escapeHtml(TYPE_LABELS[item?.type] || 'Item')
  const body =
    `<header class="doc"><h1>${escapeHtml(title)}</h1><p class="meta">${label}</p></header>` +
    (itemBodyHtml(item || {}) || '<p class="empty">Empty</p>') +
    footerHtml()
  openPrintDialog(title, body)
}

/** Export a space with all of its (decrypted) items. */
export function exportSpaceToPdf(space, items) {
  const name = (space?.name || '').trim() || 'Space'
  const desc = space?.description ? `<p class="desc">${escapeHtml(space.description)}</p>` : ''
  const tags = Array.isArray(space?.tags) && space.tags.length > 0
    ? `<p class="meta">${space.tags.map(tag => `#${escapeHtml(tag)}`).join('&ensp;')}</p>`
    : ''
  const sections = (items || []).map(itemSectionHtml).join('')
  const body =
    `<header class="doc"><h1>${escapeHtml(name)}</h1>${desc}${tags}</header>` +
    (sections || '<p class="empty">No items in this space.</p>') +
    footerHtml()
  openPrintDialog(name, body)
}
