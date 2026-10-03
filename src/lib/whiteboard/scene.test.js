import { describe, expect, it } from 'vitest'
import { boardScene, hasBoardContent, isLegacyBoard, sceneKey, toBoardContent } from './scene'

const legacy = {
  orientation: 'landscape',
  strokes: [
    { points: [[10, 20, 0.4], [30, 60, 0.6], [50, 40]], color: '#e11d48', size: 8.5 },
    { points: [[5, 5, 0.5]], color: '#000000', size: 4 }, // too short: dropped
  ],
}

describe('whiteboard scene', () => {
  it('converts an old drawing into freehand elements', () => {
    expect(isLegacyBoard(legacy)).toBe(true)
    const { elements, files, background } = boardScene(legacy)
    expect(files).toEqual({})
    expect(background).toBe('#ffffff')
    expect(elements).toHaveLength(1)
    const [el] = elements
    expect(el).toMatchObject({
      type: 'freedraw',
      x: 10,
      y: 20,
      width: 40,
      height: 40,
      points: [[0, 0], [20, 40], [40, 20]],
      pressures: [0.4, 0.6, 0.5],
      simulatePressure: false,
      strokeColor: '#e11d48',
      strokeWidth: 2,
    })
  })

  it('opens a saved board as it is', () => {
    const content = { elements: [{ id: 'a', version: 3 }], files: { f: {} }, background: '#fef3c7', preview: 'data:' }
    expect(isLegacyBoard(content)).toBe(false)
    expect(boardScene(content)).toEqual({ elements: content.elements, files: content.files, background: '#fef3c7' })
    expect(boardScene({})).toEqual({ elements: [], files: {}, background: '#ffffff' })
  })

  it('saves only live elements and the images they use', () => {
    const elements = [
      { id: 'a', type: 'image', fileId: 'f1' },
      { id: 'b', type: 'image', fileId: 'f2', isDeleted: true },
    ]
    const saved = toBoardContent(elements, { f1: { id: 'f1' }, f2: { id: 'f2' } }, '#ffffff', 'data:png')
    expect(saved).toEqual({ elements: [elements[0]], files: { f1: { id: 'f1' } }, background: '#ffffff', preview: 'data:png' })
    expect(toBoardContent([], {}, '#ffffff', 'data:png').preview).toBeNull()
  })

  it('knows when a board is empty and when it changed', () => {
    expect(hasBoardContent({ elements: [] })).toBe(false)
    expect(hasBoardContent({ elements: [{ isDeleted: true }] })).toBe(false)
    expect(hasBoardContent(legacy)).toBe(true)
    const els = [{ version: 1 }, { version: 2 }]
    expect(sceneKey(els, {}, '#fff')).not.toBe(sceneKey([{ version: 1 }, { version: 3 }], {}, '#fff'))
    expect(sceneKey(els, {}, '#fff')).not.toBe(sceneKey(els, {}, '#000'))
  })
})
