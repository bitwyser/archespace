/**
 * pdfExport.js - Export a space or a single item to PDF, fully client-side,
 * using pdfmake. The PDF is generated directly (no browser print dialog), so we
 * fully control every page: a header with the export time (top-left) and the
 * ArcheSpace logo (top-right), and a footer with the site URL (bottom-left) and
 * the page number (bottom-right). Content rendering mirrors the mobile export.
 */
import { markdownToHtml } from '../components/editors/MarkdownPreview'
import { sanitizeRichHtml } from './sanitizeHtml'
import { TYPE_LABELS } from './itemTypes'
import { strokeToSvgPath, drawDims } from './drawing'

const SITE_URL = 'https://archespace.app/'
const CHROME_COLOR = '#8a8a8a'
// A4 content width (595.28pt) minus the 40pt side margins, for full-width rules.
const CONTENT_WIDTH = 515

// ── pdfmake (lazy-loaded: keeps its font bundle out of the initial page load) ──
let pdfMakePromise = null
function getPdfMake() {
  if (!pdfMakePromise) {
    // The stock pdfmake/build/vfs_fonts uses top-level `this`, which throws
    // under ESM; use our generated font module instead.
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('./pdfVfs'),
    ]).then(([pdfMakeMod, vfsMod]) => {
      const pdfMake = pdfMakeMod.default || pdfMakeMod
      pdfMake.vfs = vfsMod.default
      // DejaVu (subsetted) covers arrows, checkboxes and other symbols Roboto
      // lacks; the mono face keeps code aligned.
      pdfMake.fonts = {
        DejaVuSans: {
          normal: 'DejaVuSans.ttf',
          bold: 'DejaVuSans-Bold.ttf',
          italics: 'DejaVuSans-Oblique.ttf',
          bolditalics: 'DejaVuSans-BoldOblique.ttf',
        },
        DejaVuMono: {
          normal: 'DejaVuSansMono.ttf',
          bold: 'DejaVuSansMono.ttf',
          italics: 'DejaVuSansMono.ttf',
          bolditalics: 'DejaVuSansMono.ttf',
        },
      }
      return pdfMake
    })
  }
  return pdfMakePromise
}

/** The inked wordmark (dark "Space") as a data URL, or '' if it can't load. */
async function loadLogoDataUrl() {
  try {
    const res = await fetch('/archespace-wordmark-print.png')
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

/** The export time, e.g. "9/19/26, 8:36 PM". */
function timestamp() {
  const d = new Date()
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  const mm = String(d.getMinutes()).padStart(2, '0')
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()}/${yy}, ${h12}:${mm} ${ampm}`
}

const emptyNode = () => ({ text: '(empty)', style: 'empty' })

/** Flatten sanitized rich HTML to plain text, keeping block boundaries. */
function htmlToText(html) {
  const div = document.createElement('div')
  div.innerHTML = sanitizeRichHtml(html || '')
  div.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
  div.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr').forEach(el => el.append('\n'))
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

const listRows = items =>
  (items || []).map(r => (r?.text ?? '').trim()).filter(t => t !== '')

const cardLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#dddddd',
  vLineColor: () => '#dddddd',
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
}
const codeLayout = {
  fillColor: () => '#f6f8fa',
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#e2e2e2',
  vLineColor: () => '#e2e2e2',
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
}
const tableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#cccccc',
  vLineColor: () => '#cccccc',
}

/** Content nodes for a single item's body, by type. */
function itemBodyNodes({ type, content }) {
  const c = content || {}
  switch (type) {
    case 'textbox':
      return c.text ? [{ text: c.text }] : [emptyNode()]
    case 'markdown': {
      const t = c.text ? htmlToText(markdownToHtml(c.text)) : ''
      return t ? [{ text: t }] : [emptyNode()]
    }
    case 'richtext': {
      const t = htmlToText(c.html)
      return t ? [{ text: t }] : [emptyNode()]
    }
    case 'code':
      return c.code
        ? [{
            table: { widths: ['*'], body: [[{ text: c.code, font: 'DejaVuMono', fontSize: 9.5, preserveLeadingSpaces: true }]] },
            layout: codeLayout,
            margin: [0, 2, 0, 0],
          }]
        : [emptyNode()]
    case 'menu_list': {
      const rows = listRows(c.items)
      return rows.length ? [{ ul: rows, margin: [4, 0, 0, 0] }] : [emptyNode()]
    }
    case 'numbered_list': {
      const rows = listRows(c.items)
      return rows.length ? [{ ol: rows, margin: [4, 0, 0, 0] }] : [emptyNode()]
    }
    case 'checkbox_list': {
      const items = (c.items || []).filter(r => (r?.text ?? '').trim() !== '')
      if (!items.length) return [emptyNode()]
      return [{
        type: 'none',
        ul: items.map(r => ({
          text: `${r.checked ? '☑' : '☐'}  ${r.text}`,
          ...(r.checked ? { color: '#777777', decoration: 'lineThrough' } : {}),
        })),
      }]
    }
    case 'card_list': {
      const cards = (c.items || []).filter(
        cd => (cd?.title ?? '').trim() !== '' || (cd?.description ?? '').trim() !== ''
      )
      if (!cards.length) return [emptyNode()]
      return cards.map(cd => ({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              ...(cd.title ? [{ text: cd.title, bold: true }] : []),
              ...(cd.description ? [{ text: cd.description, color: '#444444', margin: [0, 2, 0, 0] }] : []),
            ],
          }]],
        },
        layout: cardLayout,
        margin: [0, 0, 0, 6],
      }))
    }
    case 'table': {
      const columns = Array.isArray(c.columns) ? c.columns : []
      const rows = Array.isArray(c.rows) ? c.rows : []
      if (!columns.length && !rows.length) return [emptyNode()]
      const hasHead = columns.some(col => (col ?? '').trim() !== '')
      const colCount = columns.length || (rows[0]?.length ?? 1)
      const body = []
      if (hasHead) {
        body.push(columns.map(col => ({ text: String(col ?? ''), bold: true, fillColor: '#f5f5f5' })))
      }
      for (const row of rows) {
        const cells = Array.isArray(row) ? row : []
        body.push(Array.from({ length: colCount }, (_, i) => String(cells[i] ?? '')))
      }
      if (!body.length) return [emptyNode()]
      return [{
        table: { headerRows: hasHead ? 1 : 0, widths: Array(colCount).fill('*'), body },
        layout: tableLayout,
        fontSize: 10,
      }]
    }
    case 'secret':
      return [{ text: '•••••• (hidden secret - reveal it in the app to view)', style: 'empty' }]
    case 'draw': {
      const strokes = Array.isArray(c.strokes) ? c.strokes : []
      if (!strokes.length) return [emptyNode()]
      const { w, h } = drawDims(c.orientation)
      const paths = strokes
        .map(s => `<path d="${strokeToSvgPath(s.points, s.size)}" fill="${s.color}"/>`)
        .join('')
      const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#ffffff"/>${paths}</svg>`
      const maxW = c.orientation === 'portrait' ? 240 : 400
      return [{ svg, width: maxW, margin: [0, 2, 0, 0] }]
    }
    default:
      return [emptyNode()]
  }
}

/** A space item as a titled section with a rule under the heading. */
function itemSectionNodes(item) {
  const title = item.title || 'Untitled'
  const label = TYPE_LABELS[item.type] || 'Item'
  return [
    {
      text: [
        { text: title, bold: true, fontSize: 13 },
        { text: `   ${label}`, fontSize: 9, color: '#777777' },
      ],
      margin: [0, 12, 0, 3],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }], margin: [0, 0, 0, 8] },
    ...itemBodyNodes(item),
  ]
}

/** Build the doc and hand the user the file. */
async function generate(filename, content) {
  const [pdfMake, logo] = await Promise.all([getPdfMake(), loadLogoDataUrl()])
  const stamp = timestamp()
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 58, 40, 44],
    defaultStyle: { font: 'DejaVuSans', fontSize: 11, color: '#111111', lineHeight: 1.3 },
    styles: { empty: { italics: true, color: '#999999' } },
    header: () => ({
      margin: [40, 22, 40, 0],
      columns: [
        { text: stamp, fontSize: 8, color: CHROME_COLOR, margin: [0, 3, 0, 0] },
        logo ? { image: logo, width: 88, alignment: 'right' } : { text: '' },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 16],
      columns: [
        { text: SITE_URL, fontSize: 8, color: CHROME_COLOR },
        { text: `${currentPage}/${pageCount}`, fontSize: 8, color: CHROME_COLOR, alignment: 'right' },
      ],
    }),
    content,
  }
  const safeName = (filename || 'ArcheSpace').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'ArcheSpace'
  pdfMake.createPdf(docDefinition).download(`${safeName}.pdf`)
}

/** Export a single item (uses its current local title/content). */
export async function exportItemToPdf(item) {
  const title = (item?.title || '').trim() || 'Untitled'
  const label = TYPE_LABELS[item?.type] || 'Item'
  const content = [
    { text: title, bold: true, fontSize: 18, margin: [0, 0, 0, 2] },
    { text: label, fontSize: 9, color: '#666666', margin: [0, 0, 0, 12] },
    ...itemBodyNodes(item || {}),
  ]
  await generate(title, content)
}

/** Export a space with all of its (decrypted) items. */
export async function exportSpaceToPdf(space, items) {
  const name = (space?.name || '').trim() || 'Space'
  const content = [
    // The space name once, at the start of the document (not per page).
    { text: name, bold: true, fontSize: 18, margin: [0, 0, 0, space?.description || space?.tags?.length ? 4 : 12] },
  ]
  if (space?.description) {
    content.push({ text: space.description, color: '#444444', margin: [0, 0, 0, 4] })
  }
  if (Array.isArray(space?.tags) && space.tags.length > 0) {
    content.push({ text: space.tags.map(t => `#${t}`).join('   '), fontSize: 10, color: '#666666', margin: [0, 0, 0, 8] })
  }
  const list = items || []
  if (!list.length) {
    content.push({ text: 'No items in this space.', style: 'empty' })
  } else {
    list.forEach(item => content.push(...itemSectionNodes(item)))
  }
  await generate(name, content)
}
