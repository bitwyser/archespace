# ArcheSpace logo usage

Two lockups, one system. Use them consistently - the same component, the same
sizes per context. Don't restyle the logo per screen.

## Where it appears

Only on the public home page, the site and app icons, the link preview image
(`og-image.png`), exported PDFs, the account emails and the README. Inside the
app (sidebar, top bars, sign-in, legal pages) there is no logo.

## The two variants

- **Full wordmark** - the whole `ArcheSpace` name. "Arche" (with the mark) uses
  the theme accent; "Space" is white on dark / dark ink on light.
  Web: `WordmarkLogo` (`fill="currentColor"` -> set the accent with a `text-*`
  class).
- **Short mark** - the "A" glyph only. Use it when width is constrained or the
  wordmark would fall below its minimum size. Web: `BrandGlyph`.

## Sizes (visible glyph height, not the SVG box)

Size by the *visible* height of the artwork. The wordmark's viewBox is cropped
to the glyph so a height class maps to real pixels.

| Context                        | Variant | Height        |
| ------------------------------ | ------- | ------------- |
| Home page header               | Full    | 24px (`h-6`)  |
| Home page footer               | Full    | 28px (`h-7`)  |
| Home page hero                 | Full    | 40-48px (`h-10`) |
| Icon slot on the home page     | Short   | 28-32px (`h-8`) |
| App icon / favicon / PWA       | Short (rounded square) | per platform (16-512px) |
| PDF export page corner         | Full    | 88px wide     |

## Rules

1. **Optical sizing** - match the logo to neighbouring heavy text by visible
   cap height, never by bounding box.
2. **Minimum size** - don't render the wordmark below ~16px tall; switch to the
   short mark instead.
3. **Icon fallback** - when width is tight, use the short mark, not a shrunken
   wordmark.
4. **Clear space** - keep padding around the logo at least equal to the mark's
   height; never crowd it against edges or nav items.
5. **Contrast** - "Space" is white on dark, dark ink (`#0f1115`) on light, and
   must clear ~3:1 against its background (WCAG non-text). This is why the
   light-scheme README asset inks "Space".
6. **The badge is only for the app icon** - the in-page mark is the bare glyph;
   only the mobile/PWA app icon keeps the rounded-square background.
7. **Reuse the components** - never hand-roll a logo or a one-off size.

## Assets

- README banner: `archespace-logo.svg` (dark: Arche mint / Space white) and
  `archespace-logo-light.svg` (light: Arche mint / Space ink), shown at 360px.
- PDF export: `public/archespace-wordmark-print.png` (inked "Space").
- Account emails (`email-templates/`): `public/archespace-wordmark-email.png`.
- All of the above, plus the icons and `og-image.png`, are generated from the
  brand paths by `scripts/generate-icons.mjs`.
