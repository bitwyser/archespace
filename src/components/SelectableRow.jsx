import { SelectCheck } from './ui/SelectCheck'

/**
 * A row in Archive / Recycle bin, styled like the space and item cards:
 * borderless on a soft shadow. In select mode the whole row toggles, with a
 * thin accent ring and the check box at the end when selected.
 */
export default function SelectableRow({ selectMode, selected, onToggle, actions, children }) {
  return (
    <div
      role={selectMode ? 'button' : undefined}
      tabIndex={selectMode ? 0 : undefined}
      aria-pressed={selectMode ? selected : undefined}
      onClick={selectMode ? onToggle : undefined}
      onKeyDown={selectMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } } : undefined}
      // Select mode is always one row (the check box at the end); otherwise
      // the actions drop below the text on phones.
      className={`rounded-2xl bg-bg-card p-4 flex gap-3 shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-border ${
        selectMode ? 'items-center cursor-pointer hover:shadow-md' : 'flex-col sm:flex-row sm:items-center'
      } ${selected ? 'ring-[1.5px] ring-accent-border' : ''}`}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {selectMode
        ? <SelectCheck selected={selected} />
        : <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}
