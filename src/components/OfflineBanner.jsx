/**
 * OfflineBanner.jsx - Persistent indicator shown while the browser is offline.
 *
 * A floating top-center pill (non-interactive) so it clearly signals the offline
 * state without covering sticky page headers. Data stays readable from the
 * encrypted offline cache; edits to item text are queued and sync on reconnect.
 */
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-3">
      <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3.5 py-1.5 text-amber-300 shadow-lg backdrop-blur-md">
        <WifiOff size={14} className="shrink-0" />
        <span className="text-xs font-medium">
          You're offline - viewing saved data. Edits will sync when you reconnect.
        </span>
      </div>
    </div>
  )
}
