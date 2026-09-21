/**
 * AppSidebar.jsx - Persistent desktop left navigation (app-wide).
 *
 * Collapsible (icon-only ↔ icon+label). In icon-only mode the logo shows the
 * brand mark and the account shows just the avatar letter. Shown on sm+ screens
 * only; the mobile top bars remain the navigation on phones. `active` marks the
 * current section ('spaces' | 'archive' | 'bin' | 'settings').
 */
import {
  LayoutGrid, Archive, Trash2, Keyboard, Command, Lock, Settings, LogOut,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { BrandGlyph } from '../BrandGlyph'
import { WordmarkLogo } from '../WordmarkLogo'

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="h-3" />
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  )
}

function NavItem({ icon: Icon, label, active, count, badge, badgeColor = 'bg-accent', trailing, collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-accent/10 text-accent font-semibold'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-accent" />}
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && count != null && (
        <span className={`text-xs tabular-nums ${active ? 'text-accent' : 'text-text-muted'}`}>{count}</span>
      )}
      {!collapsed && badge > 0 && (
        <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${badgeColor} text-white text-[10px] font-bold px-1 leading-none`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {!collapsed && trailing && (
        <kbd className="text-[10px] font-mono text-text-muted border border-bg-border rounded px-1.5 py-0.5">{trailing}</kbd>
      )}
    </button>
  )
}

export default function AppSidebar({
  collapsed, onToggleCollapsed, active,
  isUnlocked, spacesCount, archiveTotal, binTotal,
  onLock, onSignOut, onCommands, onShortcuts, navigate,
}) {
  return (
    <aside
      className={`hidden sm:flex flex-col shrink-0 h-screen sticky top-0 border-r border-bg-border bg-bg-surface/40 transition-[width] duration-200 ${
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
        {/* The bare "A" mark when collapsed, the full wordmark when expanded,
            centered in the sidebar. No badge - only the mobile app icon keeps
            the box. */}
        {collapsed ? (
          <BrandGlyph className="h-8 w-8 shrink-0 text-accent" />
        ) : (
          <WordmarkLogo className="h-[22px] w-auto text-accent" />
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2">
        <SectionLabel collapsed={collapsed}>Library</SectionLabel>
        <NavItem icon={LayoutGrid} label="Spaces" active={active === 'spaces'} count={spacesCount} collapsed={collapsed} onClick={() => navigate('/app')} />
        <NavItem icon={Archive} label="Archive" active={active === 'archive'} badge={archiveTotal} collapsed={collapsed} onClick={() => navigate('/archive')} />
        <NavItem icon={Trash2} label="Bin" active={active === 'bin'} badge={binTotal} badgeColor="bg-danger" collapsed={collapsed} onClick={() => navigate('/recycle-bin')} />

        <SectionLabel collapsed={collapsed}>Tools</SectionLabel>
        <NavItem icon={Keyboard} label="Shortcuts" collapsed={collapsed} onClick={onShortcuts} />
        <NavItem icon={Command} label="Commands" collapsed={collapsed} onClick={onCommands} />
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-bg-border space-y-1">
        {isUnlocked && (
          <NavItem icon={Lock} label="Lock vault" collapsed={collapsed} onClick={onLock} />
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            title={collapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span className="flex-1 text-left truncate">Sign out</span>}
          </button>
        )}
        <NavItem icon={Settings} label="Settings" active={active === 'settings'} collapsed={collapsed} onClick={() => navigate('/settings')} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span className="flex-1 text-left">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
