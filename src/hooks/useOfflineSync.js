/**
 * useOfflineSync.js - Flush offline write queue when back online.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { flushOfflineQueue, getOfflineQueue } from '../lib/offlineQueue'
import { useToast } from '../context/ToastCore'
import { queryKeys } from '../lib/queryKeys'
import { isReadOnlyError } from '../lib/readOnly'

export function useOfflineSync() {
  const qc = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const processQueue = async () => {
      const pending = getOfflineQueue().length
      if (pending === 0) return

      // Edits to a space made read-only meanwhile can never apply: drop them
      // (rather than retrying forever) and say so.
      let refused = 0
      const flushed = await flushOfflineQueue(async (entry) => {
        if (entry.type === 'item-update') {
          const { id, title, content } = entry.payload
          const { error } = await supabase
            .from('space_items')
            .update({ title, content })
            .eq('id', id)
          if (isReadOnlyError(error)) {
            refused++
            return true
          }
          return !error
        }
        return false
      })

      const synced = flushed - refused
      if (synced > 0) {
        toast.success(`Back online - synced ${synced} change${synced === 1 ? '' : 's'}.`)
      }
      if (refused > 0) {
        toast.error(`${refused} offline change${refused === 1 ? " wasn't" : "s weren't"} saved: the space is read-only.`)
      }
      if (flushed > 0) qc.invalidateQueries({ queryKey: queryKeys.items() })
    }

    const onOnline = () => processQueue()
    window.addEventListener('online', onOnline)
    if (navigator.onLine) processQueue()
    return () => window.removeEventListener('online', onOnline)
  }, [qc, toast])
}
