/**
 * useOfflineSync.js - Flush offline write queue when back online.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { flushOfflineQueue, getOfflineQueue } from '../lib/offlineQueue'
import { useToast } from '../context/ToastCore'
import { queryKeys } from '../lib/queryKeys'

export function useOfflineSync() {
  const qc = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const processQueue = async () => {
      const pending = getOfflineQueue().length
      if (pending === 0) return

      const flushed = await flushOfflineQueue(async (entry) => {
        if (entry.type === 'item-update') {
          const { id, title, content } = entry.payload
          const { error } = await supabase
            .from('space_items')
            .update({ title, content })
            .eq('id', id)
          return !error
        }
        return false
      })

      if (flushed > 0) {
        toast.success(`Back online - synced ${flushed} change${flushed === 1 ? '' : 's'}.`)
        qc.invalidateQueries({ queryKey: queryKeys.items() })
      }
    }

    const onOnline = () => processQueue()
    window.addEventListener('online', onOnline)
    if (navigator.onLine) processQueue()
    return () => window.removeEventListener('online', onOnline)
  }, [qc, toast])
}
