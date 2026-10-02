/**
 * AppSidebar.jsx - Persistent desktop left navigation (app-wide).
 *
 * Collapsible (icon-only or icon+label). Shown on sm+ screens only; the mobile
 * top bars remain the navigation on phones. The space list folds under its
 * heading; Lock vault sits at the bottom, above a Settings menu (Commands,
 * Shortcuts, Settings, Sign out). `active` marks the current section
 * ('spaces' | 'space' | 'starred' | 'archive' | 'bin' | 'settings');
 * `activeSpaceId` the open top-level space.
 */
import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid, Folder, Star, Archive, Trash2, Keyboard, Command, Lock, Settings, LogOut,
  ChevronsLeft, ChevronsRight, ChevronRight,
} from 'lucide-react'
import { BrandGlyph } from '../BrandGlyph'
import { WordmarkLogo } from '../WordmarkLogo'
import { softColorValue } from '../../lib/spaceColors'

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '')
const MOD = IS_MAC ? '⌘' : 'Ctrl '
const SPACES_OPEN_KEY = 'arche:sidebar-spaces-open'

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="h-4" />
  return (
    <p className="px-3 pt-5 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted/70">
      {children}
    </p>
  )
}

function NavItem({ icon: Icon, iconColor, label, active, count, trailing, collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        collapsed ? 'justify-center py-2' : ''
      } ${
        active
          ? 'bg-bg-elevated text-text-primary font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60'
      }`}
    >
      <Icon
        size={17}
        className={`shrink-0 ${active ? 'text-accent' : ''}`}
        style={active ? undefined : { color: iconColor }}
      />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && trailing}
      {!collapsed && count != null && (
        <span className="text-xs tabular-nums text-text-muted">{count}</span>
      )}
    </button>
  )
}

function MenuItem({ icon: Icon, label, hint, danger, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
        danger
          ? 'text-danger hover:bg-danger-muted'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hint && <kbd className="text-[11px] font-sans text-text-muted">{hint}</kbd>}
    </button>
  )
}

/** The Settings row at the bottom, opening a menu of the account and app
 *  actions. Opens upward, or to the right when collapsed. */
function SettingsMenu({ collapsed, settingsActive, onSettings, onShortcuts, onCommands, onSignOut }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (fn) => () => { setOpen(false); fn?.() }

  return (
    <div ref={rootRef} className={`relative ${collapsed ? 'w-full' : 'flex-1 min-w-0'}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings and more"
        title={collapsed ? 'Settings and more' : undefined}
        className={`w-full flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-left transition-colors ${
          open || settingsActive
            ? 'bg-bg-elevated text-text-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60'
        } ${collapsed ? 'justify-center py-2' : ''}`}
      >
        <Settings size={17} className={`shrink-0 ${settingsActive ? 'text-accent' : ''}`} />
        {!collapsed && <span className="flex-1 truncate">Settings</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-56 rounded-xl border border-bg-border bg-bg-surface p-1.5 shadow-2xl shadow-black/30 animate-fade-in ${
            collapsed ? 'left-full bottom-0 ml-2' : 'left-0 bottom-full mb-2'
          }`}
        >
          <MenuItem icon={Command} label="Commands" hint={`${MOD}K`} onClick={run(onCommands)} />
          <MenuItem icon={Keyboard} label="Keyboard shortcuts" hint="?" onClick={run(onShortcuts)} />
          <div className="my-1.5 h-px bg-bg-border" />
          <MenuItem icon={Settings} label="Open settings" onClick={run(onSettings)} />
          {onSignOut && <MenuItem icon={LogOut} label="Sign out" danger onClick={run(onSignOut)} />}
        </div>
      )}
    </div>
  )
}

export default function AppSidebar({
  collapsed, onToggleCollapsed, active, activeSpaceId,
  isUnlocked, spaces, starredTotal, archiveTotal, binTotal,
  onLock, onSignOut, onCommands, onShortcuts, navigate,
}) {
  const [spacesOpen, setSpacesOpen] = useState(() => {
    try { return localStorage.getItem(SPACES_OPEN_KEY) !== '0' } catch { return true }
  })
  const toggleSpaces = () => {
    setSpacesOpen(prev => {
      const next = !prev
      try { localStorage.setItem(SPACES_OPEN_KEY, next ? '1' : '0') } catch { /* storage unavailable */ }
      return next
    })
  }

  return (
    <aside
      className={`hidden sm:flex flex-col shrink-0 h-screen sticky top-0 z-30 border-r border-bg-border bg-bg-surface/40 transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-44'
      }`}
    >
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate('/app')}
        aria-label="ArcheSpace"
        className="flex items-center justify-center h-16 shrink-0 px-3"
      >
        {/* The bare "A" mark when collapsed, the full wordmark when expanded. */}
        {collapsed ? (
          <BrandGlyph className="h-8 w-8 shrink-0 text-accent" />
        ) : (
          <WordmarkLogo className="h-[22px] w-auto text-accent" />
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 min-h-0 flex flex-col gap-0.5 px-2">
        <NavItem icon={LayoutGrid} label="All spaces" active={active === 'spaces'} count={spaces.length} collapsed={collapsed} onClick={() => navigate('/app')} />

        {/* The space list folds under its heading and is the only part that
            scrolls. Hidden when collapsed, where bare folder icons say nothing. */}
        {!collapsed && spaces.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggleSpaces}
              aria-expanded={spacesOpen}
              className="group flex items-center gap-1 px-3 pt-4 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted/70 hover:text-text-secondary transition-colors"
            >
              Spaces
              <ChevronRight size={12} className={`transition-transform duration-150 ${spacesOpen ? 'rotate-90' : ''}`} />
            </button>
            {spacesOpen && (
              <div className="min-h-0 overflow-y-auto scrollbar-slim flex flex-col gap-0.5">
                {spaces.map(space => (
                  <NavItem
                    key={space.id}
                    icon={Folder}
                    iconColor={softColorValue(space.color, 'cc')}
                    label={space.name || 'Untitled'}
                    active={active === 'space' && activeSpaceId === space.id}
                    trailing={space.locked && <Lock size={12} className="shrink-0 text-text-muted" aria-label="Protected" />}
                    onClick={() => navigate(`/space/${space.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <SectionLabel collapsed={collapsed}>Library</SectionLabel>
        <NavItem icon={Star} label="Starred" active={active === 'starred'} count={starredTotal} collapsed={collapsed} onClick={() => navigate('/starred')} />
        <NavItem icon={Archive} label="Archive" active={active === 'archive'} count={archiveTotal} collapsed={collapsed} onClick={() => navigate('/archive')} />
        <NavItem icon={Trash2} label="Bin" active={active === 'bin'} count={binTotal} collapsed={collapsed} onClick={() => navigate('/recycle-bin')} />
      </nav>

      {/* Footer: Lock vault, then the Settings menu and the collapse toggle */}
      <div className="shrink-0 px-2 pt-4 pb-3 space-y-0.5">
        {isUnlocked && (
          <NavItem icon={Lock} label="Lock vault" collapsed={collapsed} onClick={onLock} />
        )}
        <div className={`flex gap-0.5 ${collapsed ? 'flex-col items-stretch' : 'items-center'}`}>
          <SettingsMenu
            collapsed={collapsed}
            settingsActive={active === 'settings'}
            onSettings={() => navigate('/settings')}
            onShortcuts={onShortcuts}
            onCommands={onCommands}
            onSignOut={onSignOut}
          />
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`shrink-0 flex justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 transition-colors ${collapsed ? 'py-2' : 'h-8 w-8 items-center'}`}
          >
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
