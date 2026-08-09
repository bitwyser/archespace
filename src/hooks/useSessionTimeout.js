/**
 * useSessionTimeout.js - Absolute session timeout only.
 *
 * Signs the user out a fixed time after they logged in, regardless of
 * activity or page refreshes. The login time is anchored in localStorage
 * on sign-in, so refreshing the page does not extend the session.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SESSION_ABSOLUTE_MAX_MS } from '../lib/constants'

const STARTED_AT_KEY = 'arche:session-started-at'
const MAX_TIMEOUT_MS = 2 ** 31 - 1 // setTimeout caps at ~24.8 days

export function useSessionTimeout() {
  const timer = useRef(null)

  useEffect(() => {
    const expire = () => {
      window.dispatchEvent(new CustomEvent('arche:session-expired', { detail: { reason: 'absolute' } }))
      // Local scope: this device's own absolute timeout must not revoke the
      // user's sessions on their other devices (that would log out every
      // platform at once). Global sign-out is reserved for password changes.
      supabase.auth.signOut({ scope: 'local' })
    }

    const scheduleFrom = (startedAt) => {
      clearTimeout(timer.current)
      const remaining = startedAt + SESSION_ABSOLUTE_MAX_MS - Date.now()
      if (remaining <= 0) {
        expire()
        return
      }
      timer.current = setTimeout(expire, Math.min(remaining, MAX_TIMEOUT_MS))
    }

    // On load, anchor to the stored login time. Existing sessions with no
    // stored anchor (logged in before this shipped) start from now.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      let startedAt = Number(localStorage.getItem(STARTED_AT_KEY))
      if (!startedAt) {
        startedAt = Date.now()
        localStorage.setItem(STARTED_AT_KEY, String(startedAt))
      }
      scheduleFrom(startedAt)
    })

    // Reset the anchor on a fresh sign-in; clear it on sign-out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        const startedAt = Date.now()
        localStorage.setItem(STARTED_AT_KEY, String(startedAt))
        scheduleFrom(startedAt)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(STARTED_AT_KEY)
        clearTimeout(timer.current)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer.current)
    }
  }, [])
}
