import { createContext, useContext, useEffect } from 'react'

export const ShortcutsContext = createContext(null)

function useShortcuts() {
  const ctx = useContext(ShortcutsContext)
  if (!ctx) throw new Error('useShortcuts must be used within ShortcutsProvider')
  return ctx
}

export function useShortcut(id, handler, enabled = true) {
  const { register } = useShortcuts()
  useEffect(() => {
    if (!enabled || !handler) return undefined
    return register(id, handler)
  }, [id, handler, enabled, register])
}
