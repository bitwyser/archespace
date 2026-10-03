/**
 * generate-icons.mjs - One-off generator for the favicon, PWA icons and the
 * social share image, all rendered from the "A" mark with sharp. The app icon is the mint "A" on a dark
 * background (matching the mobile app).
 *
 * Run with: node scripts/generate-icons.mjs
 * Writes PNGs and SVGs into public/. Re-run only when the brand mark changes.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { A_PATH, GLYPH_VIEWBOX } from '../src/lib/brandPaths.js'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const MINT = '#32d3aa' // brand accent (the app's default theme colour)
const DARK = '#0d1117' // icon background

// The "A" mark placed at (x,y) with the given size in a 100-unit parent canvas.
const mark = (x, y, size, fill) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${GLYPH_VIEWBOX}"><path d="${A_PATH}" fill="${fill}" fill-rule="evenodd"/></svg>`

// Rounded-square icon: dark background, mint mark (matches favicon.svg).
const roundedMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="25" fill="${DARK}"/>
  ${mark(16, 18, 68, MINT)}
</svg>`

// Full-bleed icon for maskable / apple-touch: no transparent corners; the mark
// sits inside the safe zone so platform masking never clips it.
const solidMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="${DARK}"/>
  ${mark(24, 26, 52, MINT)}
</svg>`


// 1200x630 Open Graph / Twitter share card.
const ogImage = () => `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f1117"/>
  <rect width="1200" height="6" fill="${MINT}"/>
  <g transform="translate(100,210)">
    <rect width="200" height="200" rx="48" fill="#151a23" stroke="${MINT}" stroke-width="2"/>
    <svg x="30" y="34" width="140" height="140" viewBox="${GLYPH_VIEWBOX}"><path d="${A_PATH}" fill="${MINT}" fill-rule="evenodd"/></svg>
  </g>
  <text x="360" y="300" font-family="Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">ArcheSpace</text>
  <text x="362" y="360" font-family="Arial, sans-serif" font-size="30" fill="#aeb4c2">Everything in One Encrypted Space</text>
  <text x="100" y="560" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="${MINT}">archespace.app</text>
</svg>`

// Favicon (rounded dark square + mint mark).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="${DARK}"/>
  <svg x="5" y="6" width="22" height="22" viewBox="${GLYPH_VIEWBOX}">
    <path d="${A_PATH}" fill="${MINT}" fill-rule="evenodd"/>
  </svg>
</svg>
`

const png = (svg, file) =>
  sharp(Buffer.from(svg)).png().toFile(join(publicDir, file))

// Static SVGs.
writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg)

await Promise.all([
  png(roundedMark(192), 'icon-192.png'),
  png(roundedMark(512), 'icon-512.png'),
  png(solidMark(512), 'icon-maskable-512.png'),
  png(solidMark(180), 'apple-touch-icon.png'),
  png(roundedMark(32), 'favicon-32.png'),
  png(ogImage(), 'og-image.png'),
])

console.log(
  'Generated favicon.svg, icon-192/512, icon-maskable-512, apple-touch-icon, favicon-32, og-image'
)
