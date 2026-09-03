/**
 * useOnlineStatus.js - Reactive online state.
 *
 * Combines the browser's navigator.onLine with an app-level reachability signal
 * (see connectivity.js) so we report "offline" both when the interface is down
 * and when the server is unreachable despite a live interface.
 */
import { useEffect, useState } from 'react'
import { isReachable, subscribeReachable, setReachable } from '../lib/connectivity'

export function useOnlineStatus() {
  const [online, setOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true) && isReachable()
  )

  useEffect(() => {
    const compute = () => setOnline(navigator.onLine && isReachable())
    const goOnline = () => {
      // Interface came back - assume reachable until a request proves otherwise.
      setReachable(true)
      compute()
    }
    const goOffline = () => compute()

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const unsub = subscribeReachable(compute)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      unsub()
    }
  }, [])

  return online
}
