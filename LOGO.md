# ArcheSpace logo usage

Two lockups, one system. Use them consistently everywhere - the same component,
the same sizes per context. Don't restyle the logo per screen.

## The two variants

- **Full wordmark** - the whole `ArcheSpace` name. "Arche" (with the mark) uses
  the theme accent; "Space" is white on dark / dark ink on light.
  Web: `WordmarkLogo` (`fill="currentColor"` -> set the accent with a `text-*`
  class). Mobile: `BrandWordmark`. This is the default brand presentation.
- **Short mark** - the "A" glyph only. Use it when width is constrained or the
  wordmark would fall below its minimum size.
  Web: `BrandGlyph`. Mobile: `BrandGlyph`.

## Sizes (visible glyph height, not the SVG box)

Size by the *visible* height of the artwork. The wordmark's viewBox is cropped
to the glyph so a height class maps to real pixels.

| Context                                          | Variant | Height        |
| ------------------------------------------------ | ------- | ------------- |
| Nav / top bar (web header, sidebar, mobile bar)  | Full    | 24px (`h-6`)  |
| Footer                                           | Full    | 28px (`h-7`)  |
| Auth / hero (login, signup, splash)              | Full    | 40-48px (`h-10`; mobile splash 46) |
| Collapsed rail / icon slot                       | Short   | 28-32px (`h-8`) |
| App icon / favicon / PWA                         | Short (rounded square) | per platform (16-512px) |

## Rules

1. **Optical sizing** - match the logo to neighbouring heavy text by visible
   cap height, never by bounding box.
2. **Minimum size** - don't render the wordmark below ~16px tall; switch to the
   short mark instead (e.g. the collapsed sidebar).
3. **Icon fallback** - when width is tight, use the short mark, not a shrunken
   wordmark.
4. **Clear space** - keep padding around the logo at least equal to the mark's
   height; never crowd it against edges or nav items.
5. **Contrast** - "Space" is white on dark, dark ink (`#0f1115`) on light, and
   must clear ~3:1 against its background (WCAG non-text). This is why the
   light-scheme README asset inks "Space".
6. **The badge is only for the app icon** - the in-UI mark is the bare glyph;
   only the mobile/PWA app icon keeps the rounded-square background.
7. **Reuse the components** - never hand-roll a logo or a one-off size.

## Assets

- README banner: `archespace-logo.svg` (dark: Arche mint / Space white) and
  `archespace-logo-light.svg` (light: Arche mint / Space ink), shown at 360px.
- App icons are generated from the mark by `scripts/generate-icons.mjs`.
