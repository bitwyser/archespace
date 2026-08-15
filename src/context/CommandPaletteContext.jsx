/**
 * CommandPaletteContext.jsx - Cmd+K command palette state.
 */
import { useState, useCallback, useMemo } from 'react'
import { CommandPaletteContext } from './CommandPaletteCore'

export function CommandPaletteProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [extraCommands, setExtraCommands] = useState([])

  const registerCommands = useCallback((commands) => {
    setExtraCommands(commands)
    return () => setExtraCommands([])
  }, [])

  // Stable identities so pages can list openPalette/closePalette in effect
  // deps (e.g. to register commands) without re-firing on every open/close.
  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({
    open,
    setOpen,
    openPalette,
    closePalette,
    extraCommands,
    registerCommands,
  }), [open, extraCommands, registerCommands, openPalette, closePalette])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  )
}
