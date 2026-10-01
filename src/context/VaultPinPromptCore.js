import { createContext, useContext } from 'react'

export const VaultPinPromptContext = createContext(null)

/**
 * `askVaultPin({ title, message, confirmLabel, verify? })` opens the vault PIN
 * dialog and resolves true once the right PIN is entered, or false if
 * cancelled. `verify(pin)` replaces the check against this vault's PIN.
 */
export function useVaultPinPrompt() {
  const ctx = useContext(VaultPinPromptContext)
  if (!ctx) throw new Error('useVaultPinPrompt must be used within VaultPinPromptProvider')
  return ctx
}
