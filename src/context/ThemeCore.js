import { createContext, useContext } from 'react'

export const THEME_MODES = [
  {
    id: 'system',
    name: 'System',
    description: 'Match this device.',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Always use dark mode.',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Always use light mode.',
  },
]

export const ACCENT_COLORS = [
  {
    id: 'mint',
    name: 'Mint Green',
    description: "Arche Space's signature accent, a refined mint green.",
    swatch: '#32d3aa',
  },
  {
    id: 'lavender',
    name: 'Lavender Indigo',
    description: 'A cool indigo-violet with a fresh, modern feel.',
    swatch: '#7c6af7',
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    description: 'A warm gold accent with a calm, focused feel.',
    swatch: '#f6b84b',
  },
]

export const DEFAULT_THEME_MODE = 'system'
export const DEFAULT_ACCENT_COLOR = 'mint'

export const ThemeContext = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
