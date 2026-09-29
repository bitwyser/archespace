/**
 * useStarredItemCount.js - How many active items are starred (for the sidebar
 * count). A head-only count: no rows are fetched or decrypted.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useEncryption } from '../context/EncryptionCore'
import { queryKeys } from '../lib/queryKeys'

export function useStarredItemCount() {
  const { cryptoKey } = useEncryption()
  return useQuery({
    queryKey: queryKeys.starredCount(),
    enabled: !!cryptoKey,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('space_items')
        .select('id', { count: 'exact', head: true })
        .eq('starred', true)
        .is('deleted_at', null)
        .is('archived_at', null)
      if (error) throw error
      return count || 0
    },
  })
}
