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
    description: "ArcheSpace's signature accent, a refined mint green.",
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
  {
    id: 'sky',
    name: 'Sky Blue',
    description: 'A clear azure blue with a bright, calm feel.',
    swatch: '#38a5f0',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'A warm rose pink with a soft, friendly feel.',
    swatch: '#f56b8a',
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
