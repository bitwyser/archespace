export default function SelectableRow({ selectMode, selected, onToggle, actions, children }) {
  return (
    <div
      role={selectMode ? 'button' : undefined}
      tabIndex={selectMode ? 0 : undefined}
      onClick={selectMode ? onToggle : undefined}
      onKeyDown={selectMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } } : undefined}
      className={`bg-bg-surface rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
        selected ? 'border-[1.5px] border-accent-border bg-accent-muted' : 'border border-bg-border'
      } ${selectMode ? 'cursor-pointer' : ''}`}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          className="shrink-0 w-4 h-4 rounded border-bg-border accent-accent"
          aria-label="Select"
        />
      )}
      <div className="flex-1 min-w-0">{children}</div>
      {!selectMode && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  )
}
