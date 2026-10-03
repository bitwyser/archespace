/**
 * WhiteboardEditor.jsx - The Whiteboard item open full screen: an Excalidraw
 * board (lib/whiteboard). The card shows its preview instead
 * (WhiteboardPreview), so Excalidraw only loads when a board opens.
 *
 * Saves a moment after each change, and any pending change when it closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { WhiteboardCanvas } from '../../lib/whiteboard/WhiteboardCanvas'
import { boardScene, isLegacyBoard } from '../../lib/whiteboard/scene'
import { createBoardSaver } from '../../lib/whiteboard/saver'
import { boardToSave } from '../../lib/whiteboard/preview'

/**
 * Keys pressed on the board are Excalidraw's (tool letters, Escape), not the
 * app's shortcuts; only the command palette (Ctrl/Cmd+K) still reaches it.
 */
function keepKeysOnBoard(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') return
  e.stopPropagation()
}

export default function WhiteboardEditor({ content, onChange, readOnly = false }) {
  // The board opens once per mount; SpaceItem remounts it to discard edits.
  const [scene] = useState(() => boardScene(content))
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  const saverRef = useRef(null)
  useEffect(() => {
    const saver = createBoardSaver(async next => onChangeRef.current(await boardToSave(next)))
    saverRef.current = saver
    // Closing the board saves what's still pending.
    return () => { saver.flush() }
  }, [])
  const handleSceneChange = useCallback(next => saverRef.current?.change(next), [])

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-bg-border" onKeyDown={keepKeysOnBoard}>
      <WhiteboardCanvas
        scene={scene}
        readOnly={readOnly}
        unsaved={isLegacyBoard(content)}
        onSceneChange={handleSceneChange}
      />
    </div>
  )
}
