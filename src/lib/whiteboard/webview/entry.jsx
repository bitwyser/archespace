/**
 * The mobile app's Whiteboard: this repo's Excalidraw setup (WhiteboardCanvas)
 * running in a Flutter WebView, bundled by scripts/build-mobile-editor.mjs
 * into one offline HTML file with its fonts inlined. Both platforms save the
 * same content (scene.js).
 *
 * Bridge: the app calls `window.whiteboardApi.load({ content, editable })`
 * and `flush()`; the board answers through the `Arche` JavaScript channel with
 * `ready`, `change` ({ content }, a moment after each edit) and `flushed` (all
 * edits sent).
 */
import { createRoot } from 'react-dom/client'
import { WhiteboardCanvas } from '../WhiteboardCanvas'
import { boardScene, isLegacyBoard } from '../scene'
import { createBoardSaver } from '../saver'
import { boardToSave } from '../preview'

const post = (msg) => {
  try { window.Arche?.postMessage(JSON.stringify(msg)) } catch { /* no bridge */ }
}

const root = createRoot(document.getElementById('board'))
const saver = createBoardSaver(async (scene) => post({ type: 'change', content: await boardToSave(scene) }))

window.whiteboardApi = {
  /** Open a board: `{ content, editable }`. */
  load({ content, editable }) {
    root.render(
      <WhiteboardCanvas
        scene={boardScene(content)}
        readOnly={editable === false}
        unsaved={isLegacyBoard(content)}
        onSceneChange={saver.change}
      />
    )
  },
  /** Send any pending edit now, then `flushed`. */
  async flush() {
    await saver.flush()
    post({ type: 'flushed' })
  },
}

post({ type: 'ready' })
