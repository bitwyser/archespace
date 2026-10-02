/**
 * buttonStyles.js - The app's button styles (see Button.jsx), as class strings
 * for anything that isn't a <Button> (menu triggers, links).
 *
 *   primary      solid accent - the one main action on a screen or dialog
 *   secondary    soft tinted fill, no border - other actions (Cancel, Export)
 *   ghost        text only, tinted on hover - quiet toolbar actions
 *   danger       soft red - destructive actions in a list (Delete, Turn off)
 *   dangerSolid  solid red - the confirm button of a destructive dialog
 *
 * Sizes: xs (28px) inside item cards, sm (32px) for toolbars and rows, md
 * (36px) for dialogs and forms, lg (44px) for the full-width main button of
 * the sign-in and unlock screens.
 */
export const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const SIZES = {
  xs: 'h-7 px-2.5 text-xs rounded-lg',
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-9 px-3.5 text-sm rounded-lg',
  lg: 'h-11 px-4 text-sm rounded-xl',
}

const VARIANTS = {
  primary: 'bg-accent text-accent-fg font-semibold hover:bg-accent-hover',
  secondary: 'bg-bg-elevated text-text-primary hover:bg-bg-hover',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
  danger: 'bg-danger-muted text-danger hover:bg-danger hover:text-white',
  dangerSolid: 'bg-danger text-white font-semibold hover:bg-danger-hover',
}

/** The class string for a button style. */
export function buttonClass({ variant = 'secondary', size = 'md', className = '' } = {}) {
  return `${BUTTON_BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`.trim()
}
