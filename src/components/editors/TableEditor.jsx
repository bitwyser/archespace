/**
 * TableEditor.jsx - Grid editor for the "table" item type.
 *
 * Stores a header row plus data rows as plain-text cells:
 *   content = { columns: ["Name", "Qty"], rows: [["Apples", "3"], …] }
 * The whole structure is encrypted like any other item content. Rows and
 * columns can be added or removed; every row is kept the same width as the
 * header. On narrow screens the grid scrolls horizontally.
 */
import { useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'

// Keep at least a 1x1 grid so the editor always has something to show.
function normalise(content) {
  const columns = Array.isArray(content?.columns) && content.columns.length ? content.columns : ['']
  const rawRows = Array.isArray(content?.rows) && content.rows.length ? content.rows : [['']]
  // Pad/trim every row to the column count so the grid stays rectangular.
  const rows = rawRows.map(row => {
    const cells = Array.isArray(row) ? row.slice(0, columns.length) : []
    while (cells.length < columns.length) cells.push('')
    return cells
  })
  return { columns, rows }
}

export function TableEditor({ content, onChange }) {
  const [state, setState] = useState(() => normalise(content))
  const { columns, rows } = state

  const push = (next) => {
    setState(next)
    onChange(next)
  }

  const setHeader = (c, value) =>
    push({ columns: columns.map((col, i) => (i === c ? value : col)), rows })

  const setCell = (r, c, value) =>
    push({
      columns,
      rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)),
    })

  const addColumn = () =>
    push({ columns: [...columns, ''], rows: rows.map(row => [...row, '']) })

  const removeColumn = (c) => {
    if (columns.length <= 1) return
    push({
      columns: columns.filter((_, i) => i !== c),
      rows: rows.map(row => row.filter((_, j) => j !== c)),
    })
  }

  const addRow = () =>
    push({ columns, rows: [...rows, columns.map(() => '')] })

  const removeRow = (r) => {
    if (rows.length <= 1) return
    push({ columns, rows: rows.filter((_, i) => i !== r) })
  }

  const cellClass =
    'w-full min-w-[7rem] bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:bg-accent-muted rounded transition-colors'

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-bg-border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col, c) => (
                <th key={c} className="border-b border-r border-bg-border bg-bg-elevated p-0 align-top">
                  <div className="group flex items-center">
                    <input
                      value={col}
                      onChange={e => setHeader(c, e.target.value)}
                      placeholder={`Column ${c + 1}`}
                      aria-label={`Column ${c + 1} header`}
                      className={`${cellClass} font-semibold`}
                    />
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(c)}
                        aria-label={`Delete column ${c + 1}`}
                        title="Delete column"
                        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 mr-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border-b border-bg-border bg-bg-elevated p-0 w-9">
                <button
                  type="button"
                  onClick={addColumn}
                  aria-label="Add column"
                  title="Add column"
                  className="flex h-full w-full items-center justify-center py-2 text-text-muted hover:text-accent hover:bg-accent-muted transition-colors"
                >
                  <Plus size={15} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="group">
                {row.map((cell, c) => (
                  <td key={c} className="border-b border-r border-bg-border p-0 align-top">
                    <input
                      value={cell}
                      onChange={e => setCell(r, c, e.target.value)}
                      aria-label={`Row ${r + 1} column ${c + 1}`}
                      className={cellClass}
                    />
                  </td>
                ))}
                <td className="border-b border-bg-border p-0 w-9">
                  <button
                    type="button"
                    onClick={() => removeRow(r)}
                    disabled={rows.length <= 1}
                    aria-label={`Delete row ${r + 1}`}
                    title="Delete row"
                    className="flex h-full w-full items-center justify-center py-2 text-text-muted hover:text-danger hover:bg-danger/10 transition-all disabled:opacity-30 disabled:hover:text-text-muted disabled:hover:bg-transparent opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-text-muted hover:text-accent text-sm transition-colors py-1"
      >
        <Plus size={14} /> Add row
      </button>
    </div>
  )
}
