import { describe, it, expect, vi } from 'vitest'

// Captures what would be written to Supabase.
const inserted = { spaces: [], space_items: [] }
vi.mock('./supabase', () => ({
  supabase: {
    from: (table) => ({
      insert: (rows) => {
        inserted[table].push(...[].concat(rows))
        return table === 'spaces'
          ? { select: () => ({ single: async () => ({ data: { id: 'space-1' }, error: null }) }) }
          : Promise.resolve({ error: null })
      },
    }),
  },
}))

import welcome from '../../spec/welcome-space.json'
import { ITEM_TYPES } from './constants'
import { isRichDoc } from './richText/doc'
import { decryptItem, decryptSpace } from './dataProtection'
import { createWelcomeSpace } from './welcomeSpace'

const newKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])

describe('welcome space', () => {
  it('uses only item types the apps know, in plain ASCII punctuation', () => {
    for (const item of welcome.items) {
      expect(ITEM_TYPES).toContain(item.type)
      if (item.type === 'richtext') expect(isRichDoc(item.content)).toBe(true)
    }
    expect(JSON.stringify(welcome)).not.toMatch(/[–—]/)
  })

  it('saves the space and its items encrypted with the vault key', async () => {
    const key = await newKey()
    await createWelcomeSpace('user-1', key)

    const [space] = inserted.spaces
    expect(JSON.stringify(space)).not.toContain(welcome.space.name)
    expect((await decryptSpace(space, key)).name).toBe(welcome.space.name)

    expect(inserted.space_items).toHaveLength(welcome.items.length)
    const items = await Promise.all(inserted.space_items.map(row => decryptItem(row, key)))
    expect(items.map(i => i.title)).toEqual(welcome.items.map(i => i.title))
    expect(inserted.space_items.every(row => row.space_id === 'space-1' && row.user_id === 'user-1')).toBe(true)
    // The sample protected item stays protected.
    expect(inserted.space_items.filter(row => row.locked).length).toBe(welcome.items.filter(i => i.locked).length)
    expect(inserted.space_items.some(row => row.locked)).toBe(true)
    // List entries get their own ids.
    const checklist = items.find(i => i.type === 'checkbox_list')
    expect(new Set(checklist.content.items.map(e => e.id)).size).toBe(checklist.content.items.length)
  })
})
