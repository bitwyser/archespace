/**
 * saver.js - Saves a Whiteboard a moment after it changes rather than on every
 * stroke, one save at a time and in order. `flush` saves a pending change now
 * (when the board closes) and resolves once everything is saved.
 */
export function createBoardSaver(save, delay = 600) {
  let timer = null
  let pending = null
  let running = Promise.resolve()

  const flush = () => {
    clearTimeout(timer)
    timer = null
    if (pending) {
      const scene = pending
      pending = null
      running = running.then(() => save(scene)).catch(() => {})
    }
    return running
  }

  return {
    change(scene) {
      pending = scene
      clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
  }
}
