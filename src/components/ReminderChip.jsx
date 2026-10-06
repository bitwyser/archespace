/**
 * ReminderChip.jsx - An item's reminder as a chip beside its tags: its name
 * and next time, with a repeat mark when it repeats. Red once it's over,
 * accent when it goes off today. Opens the reminder dialog when clickable.
 */
import { useEffect, useState } from 'react'
import { Bell, Repeat } from 'lucide-react'
import { currentOccurrence, dayString, describeRepeat, formatReminder, isPast } from '../lib/reminder'

export function ReminderChip({ reminder, onClick }) {
  // Kept current as time passes ("Tomorrow" becomes "Today", then past).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  const past = isPast(reminder, now)
  const today = !past && dayString(currentOccurrence(reminder, now)) === dayString(now)
  const when = formatReminder(reminder, now)
  const repeats = reminder.mode !== 'once'
  const tone = past
    ? 'border-danger/30 bg-danger-muted text-danger'
    : today
      ? 'border-accent-border bg-accent-muted text-accent'
      : 'border-bg-border bg-bg-elevated text-text-muted'
  const description = [
    `Reminder${reminder.name ? ` "${reminder.name}"` : ''}${past ? ', over' : ''}: ${when}`,
    repeats ? describeRepeat(reminder, now) : null,
  ].filter(Boolean).join(', ')
  const className = `inline-flex max-w-full items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${tone}`
  const content = (
    <>
      <Bell size={11} className="shrink-0" />
      {reminder.name && <span className="min-w-0 truncate">{reminder.name} ·</span>}
      <span className="shrink-0">{when}</span>
      {repeats && <Repeat size={11} className="shrink-0" aria-hidden="true" />}
    </>
  )

  if (!onClick) {
    return <span className={className} title={description} aria-label={description}>{content}</span>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      aria-label={`${description}. Change`}
      className={`${className} hover:brightness-110 transition`}
    >
      {content}
    </button>
  )
}
