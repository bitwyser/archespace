/**
 * useSpaces.js - Hook for managing spaces.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { supabase } from '../lib/supabase'
import { parseTags } from '../lib/spaceColors'
import { useAuth } from '../context/AuthContextCore'
import { useEncryption } from '../context/EncryptionCore'
import { assertOnline } from '../lib/offlineQueue'
import { saveRows, loadRows } from '../lib/offlineCache'
import { setReachable, isNetworkError } from '../lib/connectivity'
import { encryptSpace, decryptSpace, decryptSpaces } from '../lib/dataProtection'
import { duplicateSpaceWithItems } from '../lib/spaceDuplicate'
import { invalidateSpaceCollections, invalidateSpaceList } from '../lib/queryInvalidation'
import { queryKeys } from '../lib/queryKeys'
import {
  makeBulkSetPinned,
  makeTogglePin,
  makeReorder,
} from './entityMutations'

export function useSpaces() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { cryptoKey } = useEncryption()
  const userId = user?.id
  // Unique per hook instance so multiple mounts (e.g. the app shell + the
  // dashboard) don't collide on one realtime channel name.
  const instanceId = useId()

  const query = useQuery({
    queryKey: queryKeys.spaces(),
    enabled: !!cryptoKey,
    // 'always' so the queryFn still runs while offline and can fall back to the
    // encrypted cache (the default 'online' mode would pause it with no data).
    networkMode: 'always',
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('spaces')
          .select('*')
          .is('deleted_at', null)
          .is('archived_at', null)
          .order('pinned', { ascending: false })
          .order('position', { ascending: true })
          .order('created_at', { ascending: false })

        if (error) throw error
        const rows = data || []
        setReachable(true)
        saveRows(userId, 'spaces', rows) // cache ciphertext for offline reads
        return decryptSpaces(rows, cryptoKey)
      } catch (err) {
        // Fall back to the encrypted cache on any network failure - navigator
        // .onLine can wrongly report "online" (LAN with no internet, server
        // down), so key off the actual failure, not just the interface state.
        if (isNetworkError(err)) {
          setReachable(false)
          const cached = await loadRows(userId, 'spaces')
          if (cached) return decryptSpaces(cached, cryptoKey)
        }
        throw err
      }
    },
  })

  useEffect(() => {
    // Coalesce bursts of row changes (e.g. a reorder updating many rows, or the
    // realtime echo of our own optimistic writes) into a single invalidation.
    let timer
    const channel = supabase
      .channel(`spaces-realtime-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spaces' },
        () => {
          clearTimeout(timer)
          timer = setTimeout(() => invalidateSpaceCollections(qc), 250)
        }
      )
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [qc, instanceId])

  const create = useMutation({
    mutationFn: async ({ name, description, color, tags, parentId = null }) => {
      assertOnline()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('Not authenticated')

      // Position among siblings (same parent).
      const position = (query.data || []).filter(
        s => (s.parent_id ?? null) === (parentId ?? null)
      ).length

      const encrypted = await encryptSpace({
        name,
        description: description || '',
        color: color || null,
        tags: parseTags(tags),
      }, cryptoKey)

      const insert = {
        name: encrypted.name,
        description: encrypted.description,
        user_id: userId,
        position,
        color: color || null,
        tags: encrypted.tags,
      }
      // Only send parent_id when nesting, so top-level creation still works on
      // databases that have not run the parent_id migration yet.
      if (parentId) insert.parent_id = parentId

      const { data, error } = await supabase
        .from('spaces')
        .insert(insert)
        .select()
        .single()
      if (error) throw error
      return decryptSpace(data, cryptoKey)
    },
    onSuccess: () => invalidateSpaceList(qc),
  })

  const update = useMutation({
    mutationFn: async ({ id, name, description, color, tags }) => {
      assertOnline()
      const payload = { name, description }
      if (color !== undefined) payload.color = color
      if (tags !== undefined) payload.tags = parseTags(tags)

      const encrypted = await encryptSpace(payload, cryptoKey)
      const dbPayload = { ...payload, name: encrypted.name, description: encrypted.description }
      if (tags !== undefined) dbPayload.tags = encrypted.tags

      const { data, error } = await supabase
        .from('spaces')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return decryptSpace(data, cryptoKey)
    },
    onSuccess: () => invalidateSpaceList(qc),
  })

  const togglePin = useMutation(makeTogglePin({
    table: 'spaces',
    qc,
    queryKey: queryKeys.spaces(),
    invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.spaces() }),
  }))

  const reorder = useMutation(makeReorder({
    qc,
    queryKey: queryKeys.spaces(),
    rpc: 'update_space_positions',
    invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.spaces() }),
  }))

  // Child space ids derived from the loaded list (empty pre-migration), so
  // cascades never reference parent_id in a query that could fail before the
  // column exists.
  const childIdsOf = (ids) => {
    const set = new Set(ids)
    return (query.data || []).filter(s => set.has(s.parent_id)).map(s => s.id)
  }

  const remove = useMutation({
    mutationFn: async (id) => {
      assertOnline()
      const ids = [id, ...childIdsOf([id])]
      const { error } = await supabase
        .from('spaces')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const archive = useMutation({
    mutationFn: async (id) => {
      assertOnline()
      const now = new Date().toISOString()
      const spaceIds = [id, ...childIdsOf([id])]
      const { error: spaceError } = await supabase
        .from('spaces')
        .update({ archived_at: now })
        .in('id', spaceIds)
      if (spaceError) throw spaceError
      const { error: itemError } = await supabase
        .from('space_items')
        .update({ archived_at: now })
        .in('space_id', spaceIds)
        .is('deleted_at', null)
      if (itemError) throw itemError
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const duplicate = useMutation({
    mutationFn: async (id) => {
      assertOnline()
      const source = query.data?.find(c => c.id === id)
      if (!source) throw new Error('Space not found')
      const newCol = await duplicateSpaceWithItems(source, cryptoKey, query.data?.length || 0)
      return decryptSpace(newCol, cryptoKey)
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const bulkRemove = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      assertOnline()
      const allIds = [...new Set([...ids, ...childIdsOf(ids)])]
      const { error } = await supabase
        .from('spaces')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', allIds)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const bulkArchive = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      assertOnline()
      const now = new Date().toISOString()
      const spaceIds = [...new Set([...ids, ...childIdsOf(ids)])]
      const { error: spaceError } = await supabase
        .from('spaces')
        .update({ archived_at: now })
        .in('id', spaceIds)
      if (spaceError) throw spaceError

      const { error: itemError } = await supabase
        .from('space_items')
        .update({ archived_at: now })
        .in('space_id', spaceIds)
        .is('deleted_at', null)
      if (itemError) throw itemError
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  const bulkSetPinned = useMutation(makeBulkSetPinned({
    table: 'spaces',
    invalidate: () => invalidateSpaceCollections(qc),
  }))

  const bulkDuplicate = useMutation({
    mutationFn: async (cols) => {
      assertOnline()
      for (const source of cols) {
        await duplicateSpaceWithItems(source, cryptoKey, query.data?.length || 0)
      }
    },
    onSuccess: () => invalidateSpaceCollections(qc),
  })

  return {
    ...query,
    create,
    update,
    togglePin,
    remove,
    reorder,
    archive,
    duplicate,
    bulkRemove,
    bulkArchive,
    bulkSetPinned,
    bulkDuplicate,
  }
}
