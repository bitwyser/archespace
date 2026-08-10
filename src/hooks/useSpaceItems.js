/**
 * useSpaceItems.js - Hook for items within a single space.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useEncryption } from '../context/EncryptionCore'
import { encryptItem, decryptItem, decryptItems } from '../lib/dataProtection'
import { invalidateSpaceItems } from '../lib/queryInvalidation'
import { queryKeys } from '../lib/queryKeys'
import {
  makeSoftDelete,
  makeBulkSoftDelete,
  makeBulkSetPinned,
  makeTogglePin,
  makeReorder,
} from './entityMutations'

const defaultContent = {
  textbox: { text: '' },
  checkbox_list: {
    items: [{ id: crypto.randomUUID(), text: '', checked: false }],
  },
  menu_list: { items: [] },
  numbered_list: { items: [] },
  card_list: { items: [] },
  markdown: { text: '' },
  code: { code: '' },
  secret: { secret: true, cipher: '' },
  draw: { strokes: [] },
  table: { columns: ['', ''], rows: [['', ''], ['', '']] },
}

export function useSpaceItems(spaceId) {
  const qc = useQueryClient()
  const { cryptoKey } = useEncryption()

  const query = useQuery({
    queryKey: queryKeys.items(spaceId),
    enabled: !!spaceId && !!cryptoKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('space_items')
        .select('*')
        .eq('space_id', spaceId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .order('pinned', { ascending: false })
        .order('position', { ascending: true })
      if (error) throw error
      return decryptItems(data || [], cryptoKey)
    },
  })

  useEffect(() => {
    if (!spaceId) return
    // Coalesce bursts of row changes (e.g. a reorder updating many rows, or the
    // realtime echo of our own optimistic writes) into a single invalidation.
    let timer
    const channel = supabase
      .channel(`items-${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'space_items',
          filter: `space_id=eq.${spaceId}`,
        },
        () => {
          clearTimeout(timer)
          timer = setTimeout(() => invalidateSpaceItems(qc, spaceId), 250)
        }
      )
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [spaceId, qc])

  const create = useMutation({
    mutationFn: async ({ type, title, content }) => {
      const items = query.data || []
      const position = items.length
      const plain = {
        type,
        title: title || '',
        content: content ?? defaultContent[type] ?? {},
      }
      const encrypted = await encryptItem(plain, cryptoKey)

      const { data, error } = await supabase
        .from('space_items')
        .insert({
          space_id: spaceId,
          type: plain.type,
          title: encrypted.title,
          content: encrypted.content,
          position,
        })
        .select()
        .single()
      if (error) throw error
      return decryptItem(data, cryptoKey)
    },
    onSuccess: () => {
      invalidateSpaceItems(qc, spaceId)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, title, content }) => {
      const encrypted = await encryptItem({ title, content }, cryptoKey)
      const { data, error } = await supabase
        .from('space_items')
        .update({ title: encrypted.title, content: encrypted.content })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return decryptItem(data, cryptoKey)
    },
    onSuccess: () => invalidateSpaceItems(qc, spaceId),
  })

  const togglePin = useMutation(makeTogglePin({
    table: 'space_items',
    qc,
    queryKey: queryKeys.items(spaceId),
    invalidate: () => invalidateSpaceItems(qc, spaceId),
  }))

  const remove = useMutation(makeSoftDelete({
    table: 'space_items',
    invalidate: () => invalidateSpaceItems(qc, spaceId),
  }))

  const archive = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('space_items')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateSpaceItems(qc, spaceId)
    },
  })

  const duplicate = useMutation({
    mutationFn: async (item) => {
      const items = query.data || []
      const plain = {
        type: item.type,
        title: item.title ? `${item.title} (copy)` : 'Untitled (copy)',
        content: structuredClone(item.content),
      }
      const encrypted = await encryptItem(plain, cryptoKey)
      const { data, error } = await supabase
        .from('space_items')
        .insert({
          space_id: spaceId,
          type: plain.type,
          title: encrypted.title,
          content: encrypted.content,
          position: items.length,
          pinned: false,
        })
        .select()
        .single()
      if (error) throw error
      return decryptItem(data, cryptoKey)
    },
    onSuccess: () => {
      invalidateSpaceItems(qc, spaceId)
    },
  })

  const reorder = useMutation(makeReorder({
    qc,
    queryKey: queryKeys.items(spaceId),
    rpc: 'update_item_positions',
    invalidate: () => invalidateSpaceItems(qc, spaceId),
  }))

  const bulkRemove = useMutation(makeBulkSoftDelete({
    table: 'space_items',
    invalidate: () => invalidateSpaceItems(qc, spaceId),
  }))

  const move = useMutation({
    mutationFn: async ({ ids, targetSpaceId }) => {
      if (!ids?.length || !targetSpaceId || targetSpaceId === spaceId) return

      const { count, error: countError } = await supabase
        .from('space_items')
        .select('id', { count: 'exact', head: true })
        .eq('space_id', targetSpaceId)
        .is('deleted_at', null)
        .is('archived_at', null)
      if (countError) throw countError

      const basePosition = count || 0
      const updates = ids.map((id, index) =>
        supabase
          .from('space_items')
          .update({
            space_id: targetSpaceId,
            position: basePosition + index,
            pinned: false,
          })
          .eq('id', id)
      )

      const results = await Promise.all(updates)
      const failed = results.find(result => result.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: (_data, variables) => {
      invalidateSpaceItems(qc, spaceId)
      invalidateSpaceItems(qc, variables?.targetSpaceId)
    },
  })

  const bulkArchive = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return
      const { error } = await supabase
        .from('space_items')
        .update({ archived_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceItems(qc, spaceId),
  })

  const bulkSetPinned = useMutation(makeBulkSetPinned({
    table: 'space_items',
    invalidate: () => invalidateSpaceItems(qc, spaceId),
  }))

  const bulkDuplicate = useMutation({
    mutationFn: async (itemsToCopy) => {
      if (!itemsToCopy?.length) return
      const basePos = query.data?.length || 0
      const rows = await Promise.all(
        itemsToCopy.map(async (item, i) => {
          const plain = {
            title: item.title ? `${item.title} (copy)` : 'Untitled (copy)',
            content: structuredClone(item.content),
          }
          const encrypted = await encryptItem(plain, cryptoKey)
          return {
            space_id: spaceId,
            type: item.type,
            title: encrypted.title,
            content: encrypted.content,
            position: basePos + i,
            pinned: false,
          }
        })
      )
      const { error } = await supabase.from('space_items').insert(rows)
      if (error) throw error
    },
    onSuccess: () => invalidateSpaceItems(qc, spaceId),
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
    move,
    bulkRemove,
    bulkArchive,
    bulkSetPinned,
    bulkDuplicate,
  }
}
