/**
 * UpcomingPage.jsx - Every item with a reminder, from anywhere, grouped by
 * when it next goes off (Today, Tomorrow, Next 7 days, Later), earliest
 * first, and Past for those that have gone off for the last time.
 *
 * Items show as full item cards (editable here, like inside a space), each
 * labelled with where it lives. Removing an item's reminder takes it off.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'
import { useSpaces } from '../hooks/useSpaces'
import { useItemBoard } from '../hooks/useItemBoard'
import { useColumnCount } from '../hooks/useColumnCount'
import { UPCOMING_ITEMS } from '../hooks/useSpaceItems'
import { useRegisterPageActions } from '../context/PageActionsCore'
import SpaceItem from '../components/SpaceItem'
import { IconButton } from '../components/ui/Button'
import ItemBoardModals from '../components/ItemBoardModals'
import { Spinner } from '../components/ui/UI'
import { REMINDER_GROUPS, compareReminders, reminderGroup } from '../lib/reminder'

export default function UpcomingPage() {
  const navigate = useNavigate()
  const { data: spaces = [], isLoading: spacesLoading } = useSpaces()
  const board = useItemBoard(UPCOMING_ITEMS)
  const { items, isLoading: itemsLoading } = board
  const cols = useColumnCount()

  const spaceNames = useMemo(
    () => Object.fromEntries(spaces.map(s => [s.id, s.name || 'Untitled'])),
    [spaces]
  )
  const readOnlySpaceIds = useMemo(
    () => new Set(spaces.filter(s => s.read_only).map(s => s.id)),
    [spaces]
  )

  // Regroup as time passes: a reminder moves on to its next time, or to Past
  // once it has gone off for the last time.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // A removed reminder leaves at once (before the list reloads).
  const groups = useMemo(() => {
    const withReminder = items
      .filter(it => it.reminder)
      .sort((a, b) => compareReminders(a.reminder, b.reminder, now))
    return REMINDER_GROUPS
      .map(group => ({
        ...group,
        items: withReminder.filter(it => reminderGroup(it.reminder, now) === group.id),
      }))
      .filter(group => group.items.length > 0)
  }, [items, now])
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const past = groups.find(g => g.id === 'past')?.items.length ?? 0

  const { closeAll } = board
  const pageActions = useMemo(() => ({ onEscape: closeAll }), [closeAll])
  useRegisterPageActions(pageActions)

  const isLoading = spacesLoading || itemsLoading

  const renderItemCard = (item, index) => (
    <div
      key={item.id}
      data-item-id={item.id}
      className={`transition-all duration-300 animate-fade-in-up ${
        board.flashItemId === item.id ? 'rounded-2xl ring-2 ring-accent' : ''
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <SpaceItem
        item={item}
        index={index}
        forcedCollapsed={board.collapsedIds.has(item.id)}
        {...board.cardProps}
        // Items come from many spaces, in reminder order, so there's none to
        // drag.
        dragDisabled
        readOnly={readOnlySpaceIds.has(item.space_id)}
        contextLabel={item.space_id ? spaceNames[item.space_id] || 'Space' : 'Dashboard'}
      />
    </div>
  )

  // One group's cards: round-robin masonry across the columns, so the
  // earliest read first across the top.
  const renderGroup = (groupItems) => (
    <div className="flex items-start gap-2 sm:gap-3">
      {Array.from({ length: cols }, (_, col) => (
        <div key={col} className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-3">
          {groupItems.map(renderItemCard).filter((_, i) => i % cols === col)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-base pb-24">
      <header className="sticky top-0 z-20 glass">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          <IconButton icon={ArrowLeft} label="Back" size="md" className="-ml-1.5" onClick={() => navigate('/app')} />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-text-primary">Upcoming</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {total} {total === 1 ? 'reminder' : 'reminders'}{past > 0 ? ` - ${past} past` : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : total === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-bg-border flex items-center justify-center mx-auto mb-4">
              <Bell size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium">No reminders</p>
            <p className="text-text-muted text-sm mt-1">
              Add a reminder to an item from its menu to see it here.
            </p>
          </div>
        ) : (
          groups.map((group, i) => (
            <section key={group.id} className={i > 0 ? 'mt-6' : ''}>
              <h2 className={`mb-3 px-1 text-base font-semibold ${group.id === 'past' ? 'text-danger' : 'text-text-primary'}`}>
                {group.label}
                <span className="ml-2 text-sm font-normal tabular-nums text-text-muted">{group.items.length}</span>
              </h2>
              {renderGroup(group.items)}
            </section>
          ))
        )}
      </main>

      {/* Item dialogs: move to bin, move, unsaved guard */}
      <ItemBoardModals board={board} spaces={spaces} />
    </div>
  )
}
