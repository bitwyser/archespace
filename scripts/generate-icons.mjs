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
// Brand accent (the app's default theme colour). The mark is dark on it.
const ACCENT = '#32d3aa'

// The ArcheSpace mark, on its native 1095x1095 canvas. Rendered dark and
// scaled into each icon via a nested <svg>.
const LOGO_PATH =
  'M932.5 748.71C926.62 748.35 913.26 738.46 907.44 735.02C888.34 723.76 869.53 711.74 849.69 701.78C824.48 689.13 798.39 678.18 770.46 673.19C731.41 666.2 692.51 669.56 654.81 681.38C570.71 707.73 500.35 781.27 451.47 851.97C435.84 874.58 420.95 897.7 406.64 921.15C393.91 942.01 384.07 961.6 359.03 969.52C345.6 973.76 332.46 973.43 318.5 973.38C305.83 973.33 293.17 973.3 280.5 973.31C267.5 973.33 254.5 973.35 241.5 973.38C225.83 973.43 210.17 973.41 194.5 973.32C164.2 973.15 140.77 972.38 118.58 948.91C114.26 944.34 110.92 939.1 107.95 933.57C104.21 926.62 101.73 919.06 100.35 911.3C94.51 878.38 110.18 853.24 125.54 826.04C143.9 793.53 163.27 761.46 181.24 728.71C199.47 695.48 218.98 662.98 237.38 629.86C272.45 566.72 307.02 503.3 341.14 439.65C362.62 399.59 385.05 360.04 406.41 319.89C414.06 305.51 421.73 291.04 428.87 276.37C439.33 254.88 447.41 236.56 465.48 219.97C482.27 204.57 504.77 196.51 526.75 192.38C539.63 189.97 553.5 189.95 566.5 191.24C577.16 192.3 588.21 194.62 598.32 198.24C614.81 204.16 630.56 214.14 642.52 226.98C652.63 237.82 659.25 250.44 666.08 263.4C673.45 277.35 680.71 291.41 688.26 305.25C726.8 375.96 765.96 446.35 804.39 517.13C815.46 537.52 827.18 557.63 838.68 577.79C845.61 589.95 852.03 602.45 858.75 614.72C871.89 638.72 885.7 662.48 899.22 686.28C907.67 701.16 916.28 715.95 924.55 730.94C927.24 735.81 933.18 743.15 932.5 748.71ZM397.5 764.52C404.32 760.76 415.14 748.8 421.63 743.09C435.55 730.85 450.19 719.67 464.88 708.41C506.99 676.11 560.12 649.77 610.79 634.39C634.74 627.12 659.68 622.61 684.5 619.74C695.9 618.42 710.18 619.73 717.33 608.81C725.78 595.92 716.29 574.22 711.34 561.23C696.49 522.28 668.82 478.57 635.86 452.62C625.74 444.65 614.46 438.11 602.86 432.61C593.91 428.36 584.3 425.33 574.5 423.84C567.56 422.78 560.51 422.53 553.52 423.26C511.28 427.67 490.7 475.36 475.71 509.25C472.77 515.9 469.5 522.41 466.52 529.04C462.05 538.99 458 549.13 453.56 559.1C446.58 574.77 440.26 590.99 434.63 607.2C428.64 624.47 422.79 641.67 417.58 659.19C410.91 681.62 405.62 704.26 401.64 727.31C399.94 737.14 395.85 755.15 397.5 764.52ZM815.61 726.42C854.42 723.13 886.11 736.79 917.56 757.98C930.13 766.45 941.75 776.33 951.23 788.27C955.7 793.9 959.13 800.61 962.61 806.88C970.26 820.62 977.75 834.44 985.29 848.24C992.47 861.38 1000.26 874.89 1003.89 889.53C1010.21 915.02 1001.63 945.52 979.57 961.04C958.15 976.1 932.28 973.27 907.5 973.4C897.17 973.45 886.83 973.24 876.5 973.33C847.97 973.61 821.09 973.6 799.16 952.35C781.1 934.83 774.79 908.94 764.96 886.53C757.18 868.78 749.76 850.78 742.72 832.73C739.18 823.67 733.9 814.32 733.02 804.5C729.13 761.13 777.29 729.66 815.61 726.42Z'

// Dark logo placed at (x,y) with the given size, in a 100-unit parent canvas.
// The viewBox is cropped tight to the glyph so it fills the box (the source art
// has generous internal padding on its 1095 canvas).
const logo = (x, y, size) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="80 170 940 840"><path d="${LOGO_PATH}" fill="#0b1512"/></svg>`

// Rounded-square mark on a transparent background (matches favicon.svg).
const roundedMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="25" fill="${ACCENT}"/>
  ${logo(18, 20, 64)}
</svg>`

// Full-bleed mark for maskable / apple-touch icons (no transparent corners; the
// glyph sits inside the safe zone so platform masking never clips it).
const solidMark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="${ACCENT}"/>
  ${logo(26, 27, 48)}
</svg>`

// 1200x630 Open Graph / Twitter share card.
const ogImage = () => `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f1117"/>
  <rect width="1200" height="6" fill="${ACCENT}"/>
  <g transform="translate(100,210)">
    <rect width="200" height="200" rx="48" fill="${ACCENT}"/>
    <svg x="38" y="42" width="124" height="124" viewBox="80 170 940 840"><path d="${LOGO_PATH}" fill="#0b1512"/></svg>
  </g>
  <text x="360" y="285" font-family="Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">ArcheSpace</text>
  <text x="362" y="345" font-family="Arial, sans-serif" font-size="30" fill="#aeb4c2">Private, end-to-end encrypted spaces</text>
  <text x="362" y="388" font-family="Arial, sans-serif" font-size="30" fill="#aeb4c2">for everything you're working on.</text>
  <text x="100" y="560" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="${ACCENT}">archespace.app</text>
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
