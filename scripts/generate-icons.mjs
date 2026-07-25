/**
 * generate-icons.mjs - One-off generator for PWA icons and the social share
 * image, rendered from the Arche brand mark with sharp.
 *
 * Run with: node scripts/generate-icons.mjs
 * Outputs PNGs into public/. Re-run only when the brand mark changes.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const PURPLE = '#7c6af7'

// Rounded-square mark on a transparent background (matches favicon.svg).
const roundedMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="${PURPLE}"/>
  <text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">AS</text>
</svg>`

// Full-bleed mark for maskable / apple-touch icons (no transparent corners; the
// glyph sits inside the safe zone so platform masking never clips it).
const solidMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="${PURPLE}"/>
  <text x="50" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">AS</text>
</svg>`

// 1200x630 Open Graph / Twitter share card.
const ogImage = () => `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f1117"/>
  <rect width="1200" height="6" fill="${PURPLE}"/>
  <g transform="translate(100,210)">
    <rect width="200" height="200" rx="48" fill="${PURPLE}"/>
    <text x="100" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" font-weight="700" fill="#ffffff">AS</text>
  </g>
  <text x="360" y="285" font-family="Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">Arche Space</text>
  <text x="362" y="345" font-family="Arial, sans-serif" font-size="30" fill="#aeb4c2">Private, end-to-end encrypted spaces</text>
  <text x="362" y="388" font-family="Arial, sans-serif" font-size="30" fill="#aeb4c2">for everything you're working on.</text>
  <text x="100" y="560" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="${PURPLE}">archespace.cc</text>
</svg>`

const png = (svg, file) =>
  sharp(Buffer.from(svg)).png().toFile(join(publicDir, file))

await Promise.all([
  png(roundedMark(192), 'icon-192.png'),
  png(roundedMark(512), 'icon-512.png'),
  png(solidMark(512), 'icon-maskable-512.png'),
  png(solidMark(180), 'apple-touch-icon.png'),
  png(roundedMark(32), 'favicon-32.png'),
  png(ogImage(), 'og-image.png'),
])

console.log('Generated: icon-192, icon-512, icon-maskable-512, apple-touch-icon, favicon-32, og-image')
