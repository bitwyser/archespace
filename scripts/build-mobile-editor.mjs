/**
 * build-mobile-editor.mjs - Builds the mobile app's WebView editors from this
 * repo, each bundled into one offline HTML file the Flutter app loads:
 *   - rich_text_editor.html: the Rich text editor (src/lib/richText).
 *   - whiteboard_editor.html: the Whiteboard (src/lib/whiteboard), Excalidraw
 *     with its fonts inlined.
 *
 *   npm run build:mobile-editor [-- <output folder>]
 *
 * Writes to the mobile repo's assets when it sits next to this one
 * (../archespace-mobile/assets/), else to dist-mobile-editor/. Rebuild whenever
 * either source changes, so both platforms behave the same.
 */
import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXCALIDRAW_FONT_DIR, rewriteExcalidrawFonts } from './excalidraw-fonts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mobileAssets = resolve(root, '../archespace-mobile/assets')
const outDir = resolve(process.argv[2] || (existsSync(mobileAssets) ? mobileAssets : `${root}/dist-mobile-editor`))

const common = {
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  legalComments: 'none',
  write: false,
}

/** Inline a bundle (and its CSS) into a template; "</" can't end a tag early. */
function page(templatePath, js, css = '') {
  const template = readFileSync(resolve(root, templatePath), 'utf8')
  return template
    .replace('/*__STYLES__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__BUNDLE__*/', () => js.replace(/<\/script/gi, '<\\/script'))
}

function write(name, html) {
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, name)
  writeFileSync(out, html)
  console.log(`Mobile editor: ${out} (${Math.round(html.length / 1024)} KB)`)
}

// Rich text
const richText = await build({
  ...common,
  entryPoints: [resolve(root, 'src/lib/richText/webview/entry.js')],
})
write('rich_text_editor.html', page('src/lib/richText/webview/template.html', richText.outputFiles[0].text))

// Whiteboard: Excalidraw with its fonts as data URLs (no network in the
// WebView), English only, and without the Mermaid import (as on web).
const excalidrawOffline = {
  name: 'excalidraw-offline',
  setup(b) {
    b.onResolve({ filter: /^\.\/locales\// }, (args) =>
      args.importer.includes('@excalidraw') && !/\/en-/.test(args.path)
        ? { path: args.path, namespace: 'unused-locale' }
        : undefined
    )
    b.onLoad({ filter: /.*/, namespace: 'unused-locale' }, () => ({ contents: 'export default {}' }))
    b.onLoad({ filter: /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/].*\.js$/ }, (args) => {
      const inline = (family, file) => {
        const data = readFileSync(join(EXCALIDRAW_FONT_DIR, family, file)).toString('base64')
        return JSON.stringify(`data:font/woff2;base64,${data}`)
      }
      return { contents: rewriteExcalidrawFonts(readFileSync(args.path, 'utf8'), inline), loader: 'js' }
    })
  },
}

const whiteboard = await build({
  ...common,
  entryPoints: [resolve(root, 'src/lib/whiteboard/webview/entry.jsx')],
  outdir: 'whiteboard', // names the JS and CSS outputs; nothing is written
  jsx: 'automatic',
  conditions: ['production'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl' },
  alias: { '@excalidraw/mermaid-to-excalidraw': resolve(root, 'src/lib/whiteboard/noMermaid.js') },
  plugins: [excalidrawOffline],
  logOverride: { 'empty-import-meta': 'silent' },
})
const output = (ext) => whiteboard.outputFiles.find(f => f.path.endsWith(ext))?.text || ''
write('whiteboard_editor.html', page('src/lib/whiteboard/webview/template.html', output('.js'), output('.css')))
