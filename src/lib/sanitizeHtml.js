/**
 * sanitizeHtml.js - Allowlist HTML sanitiser for the Rich Text item type.
 *
 * Rich Text content is stored as HTML (bold / italic / underline / font size).
 * Because that HTML is decrypted and rendered with dangerouslySetInnerHTML, it
 * must be sanitised on both save and render. We keep the same no-dependency,
 * hand-rolled philosophy as MarkdownPreview: a strict allowlist of tags and
 * style properties, everything else stripped.
 *
 * Allowed tags come from what the toolbar produces (execCommand) plus common
 * paste output: inline formatting, font size, and simple block/line structure.
 * Unknown tags are unwrapped (their text is kept); scripts, event handlers,
 * links, images and arbitrary attributes are dropped.
 */

/** Tags kept as-is (attributes still filtered below). */
const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
  'BR', 'P', 'DIV', 'SPAN', 'FONT', 'UL', 'OL', 'LI',
])

/** CSS properties allowed inside a `style` attribute. */
const ALLOWED_STYLE_PROPS = new Set([
  'font-weight', 'font-style', 'font-size',
  'text-decoration', 'text-decoration-line',
])

/** Keep only safe declarations from a `style` attribute value. */
function sanitizeStyle(style) {
  if (!style || typeof style !== 'string') return ''
  const kept = []
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue
    // Reject anything that could smuggle a resource or expression.
    if (/url\(|expression|javascript:|[()<>]/i.test(value)) continue
    if (!/^[a-z0-9.%#,\s-]+$/i.test(value)) continue
    kept.push(`${prop}: ${value}`)
  }
  return kept.join('; ')
}

/** Recursively clean a node's subtree in place. */
function cleanNode(node, doc) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === 8 /* comment */) {
      child.remove()
      continue
    }
    if (child.nodeType !== 1 /* element */) continue // text nodes kept as-is

    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Unwrap: clean its contents, then splice them in place of the tag.
      cleanNode(child, doc)
      while (child.firstChild) node.insertBefore(child.firstChild, child)
      child.remove()
      continue
    }

    // Allowed tag: strip every attribute except a filtered style / font size.
    const style = sanitizeStyle(child.getAttribute('style'))
    const fontSize =
      child.tagName === 'FONT' ? child.getAttribute('size') : null
    for (const attr of Array.from(child.attributes)) {
      child.removeAttribute(attr.name)
    }
    if (style) child.setAttribute('style', style)
    if (fontSize && /^[1-7]$/.test(fontSize.trim())) {
      child.setAttribute('size', fontSize.trim())
    }

    cleanNode(child, doc)
  }
}

/**
 * Return a sanitised copy of `html` safe for dangerouslySetInnerHTML.
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeRichHtml(html) {
  if (!html || typeof html !== 'string') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  cleanNode(doc.body, doc)
  return doc.body.innerHTML
}

/**
 * Flatten Rich Text HTML to plain text (for search indexing and clipboard).
 * Block boundaries and <br> become newlines.
 *
 * @param {string} html
 * @returns {string}
 */
export function richHtmlToPlainText(html) {
  if (!html || typeof html !== 'string') return ''
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|ul|ol)\s*>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
