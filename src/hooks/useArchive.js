/**
 * useArchive.js - Archived spaces and items (reversible, not deleted).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useEncryption } from '../context/EncryptionCore'
import { fetchStoredCollection } from '../lib/storedCollectionQuery'
import { invalidateArchive, invalidateSpaceCollections } from '../lib/queryInvalidation'
import { queryKeys } from '../lib/queryKeys'

export function useArchive() {
  const qc = useQueryClient()
  const { cryptoKey } = useEncryption()

  const query = useQuery({
    queryKey: queryKeys.archive(),
    enabled: !!cryptoKey,
    queryFn: () => fetchStoredCollection({
      cryptoKey,
      spaceQuery: q => q
        .not('archived_at', 'is', null)
        .is('deleted_at', null)
        .order('archived_at', { ascending: false }),
      itemQuery: q => q
        .not('archived_at', 'is', null)
        .is('deleted_at', null)
        .order('archived_at', { ascending: false }),
    }),
  })

  const unarchiveSpace = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('spaces')
        .update({ archived_at: null })
        .eq('id', id)
      if (error) throw error
      const { error: itemError } = await supabase
        .from('space_items')
        .update({ archived_at: null })
        .eq('space_id', id)
        .not('archived_at', 'is', null)
      if (itemError) throw itemError
    },
    onSuccess: () => invalidateArchive(qc),
  })

  const bulkUnarchiveSpaces = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      const { error: colErr } = await supabase
        .from('spaces')
        .update({ archived_at: null })
        .in('id', ids)
      if (colErr) throw colErr
      const { error: itemErr } = await supabase
        .from('space_items')
        .update({ archived_at: null })
        .in('space_id', ids)
      if (itemErr) throw itemErr
    },
    onSuccess: () => invalidateArchive(qc),
  })

  const bulkUnarchiveItems = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      const { error } = await supabase
        .from('space_items')
        .update({ archived_at: null })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateArchive(qc),
  })

  const unarchiveItem = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('space_items')
        .update({ archived_at: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateArchive(qc),
  })

  // ── Move to bin (archive → recycle bin) ──
  // Sets deleted_at and clears archived_at so the row leaves the archive and
  // appears in the bin (which requires archived_at to be null).
  const moveSpaceToBin = useMutation({
    mutationFn: async (id) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('spaces')
        .update({ deleted_at: now, archived_at: null })
        .eq('id', id)
      if (error) throw error
      // Send its archived items to the bin too, so none are left orphaned.
      const { error: itemError } = await supabase
        .from('space_items')
        .update({ deleted_at: now, archived_at: null })
        .eq('space_id', id)
        .not('archived_at', 'is', null)
      if (itemError) throw itemError
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const moveItemToBin = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('space_items')
        .update({ deleted_at: new Date().toISOString(), archived_at: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const bulkMoveSpacesToBin = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      const now = new Date().toISOString()
      const { error: colErr } = await supabase
        .from('spaces')
        .update({ deleted_at: now, archived_at: null })
        .in('id', ids)
      if (colErr) throw colErr
      const { error: itemErr } = await supabase
        .from('space_items')
        .update({ deleted_at: now, archived_at: null })
        .in('space_id', ids)
        .not('archived_at', 'is', null)
      if (itemErr) throw itemErr
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const bulkMoveItemsToBin = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      const { error } = await supabase
        .from('space_items')
        .update({ deleted_at: new Date().toISOString(), archived_at: null })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const total =
    (query.data?.spaces?.length || 0) +
    (query.data?.items?.length || 0)

  return {
    ...query,
    unarchiveSpace,
    unarchiveItem,
    bulkUnarchiveSpaces,
    bulkUnarchiveItems,
    moveSpaceToBin,
    moveItemToBin,
    bulkMoveSpacesToBin,
    bulkMoveItemsToBin,
    total,
  }
}
