import { describe, it, expect, beforeEach } from 'vitest'
import {
  hideAllItems, hideItem, isContentHidden, isSpaceHidden, revealContent, revealItem, revealSpace,
  setSpaceLocked, setSpaceLocks,
} from './itemLock'
import { filterGlobalSearch } from './search'

const note = (id, text, locked = false) => ({
  id, type: 'textbox', title: `Note ${id}`, tags: ['home'], content: { text }, locked,
})

describe('locked items', () => {
  beforeEach(() => hideAllItems())

  it('hides a locked item until it is opened, and again after', () => {
    const item = note('a', 'bank details', true)
    expect(isContentHidden(item)).toBe(true)
    revealItem('a')
    expect(isContentHidden(item)).toBe(false)
    hideItem('a')
    expect(isContentHidden(item)).toBe(true)
    revealItem('a')
    hideAllItems()
    expect(isContentHidden(item)).toBe(true)
    expect(isContentHidden(note('b', 'x'))).toBe(false)
  })

  it('hides items in a locked space and its sub-spaces, and opens them together', () => {
    setSpaceLocks([
      { id: 'top', locked: true, parent_id: null },
      { id: 'sub', locked: false, parent_id: 'top' },
      { id: 'open', locked: false, parent_id: null },
    ])
    const inSub = { ...note('x', 'hidden'), space_id: 'sub' }
    expect(isSpaceHidden('sub')).toBe(true)
    expect(isContentHidden(inSub)).toBe(true)
    expect(isContentHidden({ ...note('y', 'shown'), space_id: 'open' })).toBe(false)
    revealContent(inSub)
    expect(isSpaceHidden('top')).toBe(false)
    expect(isContentHidden(inSub)).toBe(false)
    // Locking a space here hides it at once.
    setSpaceLocked('open', true)
    expect(isSpaceHidden('open')).toBe(true)
    revealSpace('open')
    expect(isSpaceHidden('open')).toBe(false)
  })

  it('searches a locked item by title and tags only, until opened', () => {
    const items = [note('a', 'bank details', true), note('b', 'bank holiday')]
    const find = (q) => filterGlobalSearch({ spaces: [], items }, q).items.map(i => i.id)
    expect(find('bank')).toEqual(['b'])
    expect(find('Note a')).toEqual(['a'])
    expect(find('home')).toEqual(['a', 'b'])
    revealItem('a')
    expect(find('bank')).toEqual(['a', 'b'])
  })
})
