/**
 * WhiteboardCanvas.jsx - Excalidraw as ArcheSpace uses it, on web and in the
 * mobile app's WebView: offline (no collaboration, files, library or AI;
 * web embeds blocked), no image tool, and a short main menu. The board is
 * always light (a white canvas, like its saved preview), whatever the app's
 * theme: Excalidraw's dark theme shows the canvas inverted.
 */
import { useRef } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import './whiteboard.css'
import { sceneKey } from './scene'

const UI_OPTIONS = {
  canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false },
  tools: { image: false },
}

/**
 * `scene` is what opens ({ elements, files, background }); `onSceneChange`
 * gets the scene after each edit (not for view or selection changes). With
 * `unsaved` (a board converted from an old drawing) the opened scene counts
 * as a change too, so it's saved in the new format.
 */
export function WhiteboardCanvas({ scene, readOnly = false, unsaved = false, onSceneChange }) {
  const api = useRef(null)
  const lastKey = useRef(null)

  const handleChange = (elements, appState, files) => {
    const background = appState.viewBackgroundColor
    const key = sceneKey(elements, files, background)
    // The first call is the board as it opened, not an edit. It opens zoomed
    // out to show the whole drawing (never zoomed in), even on a phone.
    const opening = lastKey.current === null
    if (opening && elements.length) {
      requestAnimationFrame(() => api.current?.scrollToContent(undefined, { fitToContent: true }))
    }
    if (!readOnly && (opening ? unsaved : key !== lastKey.current)) {
      onSceneChange?.({ elements, files, background })
    }
    lastKey.current = key
  }

  return (
    <Excalidraw
      excalidrawAPI={instance => { api.current = instance }}
      initialData={{
        elements: scene.elements,
        files: scene.files,
        appState: { viewBackgroundColor: scene.background },
        scrollToContent: true,
      }}
      onChange={handleChange}
      viewModeEnabled={readOnly}
      theme="light"
      langCode="en"
      aiEnabled={false}
      validateEmbeddable={() => false}
      UIOptions={UI_OPTIONS}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <WelcomeScreen>
        <WelcomeScreen.Hints.MenuHint />
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Hints.HelpHint />
      </WelcomeScreen>
    </Excalidraw>
  )
}
