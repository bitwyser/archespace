/**
 * useReminders.js - Every active item's reminder, for the Reminders badge and
 * for setting them off. Only the ids and reminders are fetched and decrypted.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useEncryption } from '../context/EncryptionCore'
import { decryptReminder } from '../lib/dataProtection'
import { isReminderNow } from '../lib/reminder'
import { queryKeys } from '../lib/queryKeys'

export function useReminders() {
  const { cryptoKey } = useEncryption()
  return useQuery({
    queryKey: queryKeys.reminders(),
    enabled: !!cryptoKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('space_items')
        .select('id, reminder')
        .not('reminder', 'is', null)
        .is('deleted_at', null)
        .is('archived_at', null)
      if (error) throw error
      const rows = await Promise.all((data || []).map(async (row) => {
        try {
          return { id: row.id, reminder: await decryptReminder(row.reminder, cryptoKey) }
        } catch {
          return null // left over from another vault key
        }
      }))
      return rows.filter(row => row?.reminder)
    },
  })
}

/** The current time, updated each minute (so reminder labels move on). */
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/**
 * How many reminders are over or go off today (see isReminderNow). Kept
 * current: a repeating one moves on to its next day once it has gone off.
 */
export function useRemindersNowCount(reminders) {
  const now = useNow()
  return useMemo(() => reminders.filter(r => isReminderNow(r.reminder, now)).length, [reminders, now])
}
