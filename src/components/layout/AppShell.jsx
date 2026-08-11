/**
 * AppShell.jsx - Layout wrapper for authenticated routes.
 *
 * Renders the persistent desktop sidebar alongside the routed page. The sidebar
 * only appears once signed in AND the vault is unlocked; while locked (or signed
 * out) it renders just the route (the unlock gate / redirect) full-width.
 */
import { useState, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContextCore'
import { useEncryption } from '../../context/EncryptionCore'
import { useCommandPalette } from '../../context/CommandPaletteCore'
import { useToast } from '../../context/ToastCore'
import { useSpaces } from '../../hooks/useSpaces'
import { useArchive } from '../../hooks/useArchive'
import { useRecycleBin } from '../../hooks/useRecycleBin'
import { ConfirmDialog } from '../ui/UI'
import AppSidebar from './AppSidebar'

function activeFromPath(pathname) {
  if (pathname.startsWith('/archive')) return 'archive'
  if (pathname.startsWith('/recycle-bin')) return 'bin'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/app') || pathname.startsWith('/space')) return 'spaces'
  return null
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const { isUnlocked, lock } = useEncryption()
  const { openPalette } = useCommandPalette()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  // Safe before unlock: all three queries are `enabled: !!cryptoKey`.
  const { data: spaces = [] } = useSpaces()
  const { total: archiveTotal = 0 } = useArchive()
  const { total: binTotal = 0 } = useRecycleBin()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('arche:sidebar-collapsed') === '1' } catch { return false }
  })
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('arche:sidebar-collapsed', next ? '1' : '0') } catch { /* storage unavailable */ }
      return next
    })
  }, [])

  // No sidebar during the unlock gate / redirect - render the route full-width.
  if (!user || !isUnlocked) return <Outlet />

  return (
    <div className="min-h-screen bg-bg-base sm:flex">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        active={activeFromPath(location.pathname)}
        user={user}
        isUnlocked={isUnlocked}
        spacesCount={spaces.length}
        archiveTotal={archiveTotal}
        binTotal={binTotal}
        onLock={() => { lock(); toast.info('Vault locked') }}
        onSignOut={() => setConfirmSignOut(true)}
        onCommands={() => openPalette()}
        onShortcuts={() => window.dispatchEvent(new CustomEvent('arche:open-shortcuts'))}
        navigate={navigate}
      />
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need your login password and vault PIN to sign back in."
          confirmLabel="Sign out"
          destructive
          onConfirm={() => {
            setConfirmSignOut(false)
            signOut()
            toast.info('Signed out')
          }}
          onClose={() => setConfirmSignOut(false)}
        />
      )}
    </div>
  )
}
