/**
 * excalidraw-fonts.mjs - Points Excalidraw's fonts at copies this app ships,
 * for the web build (vite.config.js) and the mobile app's whiteboard
 * (build-mobile-editor.mjs).
 *
 * Excalidraw lists each font file as "./fonts/<family>/<file>.woff2" and,
 * besides any configured asset path, always adds its CDN (esm.sh) as a
 * fallback. Rewriting each one to a full URL or a data URL makes that the only
 * source, so no font is ever fetched from anywhere else. Xiaolai (13 MB of
 * Chinese handwriting) isn't shipped: it becomes "local:", Excalidraw's marker
 * for a font the system provides.
 */
import { readdirSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const EXCALIDRAW_FONT_DIR = fileURLToPath(
  new URL('../node_modules/@excalidraw/excalidraw/dist/prod/fonts/', import.meta.url)
)

const FONT_PATH = /(["'])\.\/fonts\/([A-Za-z]+)\/([\w-]+\.woff2)\1/g

const isShipped = (family) => family !== 'Xiaolai'

/** The shipped font files, as "<family>/<file>.woff2". */
export function shippedFontFiles() {
  return readdirSync(EXCALIDRAW_FONT_DIR, { recursive: true })
    .map(entry => entry.split(sep).join('/'))
    .filter(path => path.endsWith('.woff2') && isShipped(path.split('/')[0]))
}

/**
 * Rewrite the font paths in Excalidraw's code. `toSource(family, file)`
 * returns the JavaScript expression to use instead.
 */
export function rewriteExcalidrawFonts(code, toSource) {
  return code.replace(FONT_PATH, (_, _quote, family, file) =>
    isShipped(family) ? toSource(family, file) : '"local:"'
  )
}
