/**
 * build-mobile-editor.mjs - Builds the mobile app's Rich text editor: this
 * repo's Tiptap configuration (src/lib/richText) bundled into one offline HTML
 * file that the Flutter app loads in a WebView.
 *
 *   npm run build:mobile-editor [-- <output file>]
 *
 * Writes to the mobile repo's assets when it sits next to this one
 * (../archespace-mobile/assets/rich_text_editor.html), else to
 * dist-mobile-editor/. Rebuild whenever src/lib/richText changes, so both
 * platforms keep the same formatting.
 */
import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mobileAssets = resolve(root, '../archespace-mobile/assets')
const out = resolve(
  process.argv[2] ||
    (existsSync(mobileAssets)
      ? `${mobileAssets}/rich_text_editor.html`
      : `${root}/dist-mobile-editor/rich_text_editor.html`),
)

const result = await build({
  entryPoints: [resolve(root, 'src/lib/richText/webview/entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  legalComments: 'none',
  write: false,
})

// Inline the bundle; escape any "</script" so it can't end the tag early.
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const template = readFileSync(resolve(root, 'src/lib/richText/webview/template.html'), 'utf8')
const html = template.replace('/*__BUNDLE__*/', () => js)

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.log(`Mobile editor: ${out} (${Math.round(html.length / 1024)} KB)`)
