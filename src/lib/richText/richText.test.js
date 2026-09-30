// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { toRichDoc } from './convert'
import { isRichDoc, needsRichConversion, richContentToPlainText, EMPTY_RICH_DOC } from './doc'

const types = (doc) => {
  const out = new Set()
  const walk = (n) => { out.add(n.type); (n.content || []).forEach(walk) }
  walk(doc)
  return out
}
const marks = (doc) => {
  const out = new Set()
  const walk = (n) => { (n.marks || []).forEach(m => out.add(m.type)); (n.content || []).forEach(walk) }
  walk(doc)
  return out
}

describe('rich text conversion', { timeout: 20000 }, () => {
  it('converts old Markdown notes, keeping structure', () => {
    const md = [
      '# Title', '', 'Some **bold** and *italic* and a [link](https://example.com).', '',
      '- one', '- two', '', '1. first', '', '- [ ] open', '- [x] done', '', '> quote', '',
      '```', 'code', '```', '', '| A | B |', '| - | - |', '| 1 | 2 |',
    ].join('\n')
    const doc = toRichDoc('markdown', { text: md })
    const t = types(doc)
    for (const type of ['heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'table']) {
      expect(t.has(type), type).toBe(true)
    }
    expect([...marks(doc)]).toEqual(expect.arrayContaining(['bold', 'italic', 'link']))
    expect(JSON.stringify(doc)).toContain('"checked":true')
  })

  it('converts old Rich text HTML, keeping bold, italic and underline', () => {
    const doc = toRichDoc('richtext', { html: '<b>Bold</b> <i>it</i> <u>under</u><br>next<div>para</div>' })
    expect([...marks(doc)]).toEqual(expect.arrayContaining(['bold', 'italic', 'underline']))
    expect(richContentToPlainText('richtext', { doc })).toContain('under')
  })

  it('drops unsafe HTML from old Rich text (at most harmless text is left)', () => {
    const doc = toRichDoc('richtext', {
      html: '<img src=x onerror=alert(1)>ok<script>bad()</script><a href="javascript:alert(1)">x</a>',
    })
    const json = JSON.stringify(doc)
    expect(json).not.toContain('onerror')
    expect(json).not.toContain('javascript:')
    expect([...types(doc)].sort()).toEqual(['doc', 'paragraph', 'text'])
  })

  it('leaves Tiptap content as it is, and handles empty content', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    expect(toRichDoc('richtext', { doc })).toBe(doc)
    expect(toRichDoc('richtext', { html: '' })).toEqual(EMPTY_RICH_DOC)
    expect(toRichDoc('markdown', {})).toEqual(EMPTY_RICH_DOC)
  })
})

describe('rich text helpers', () => {
  it('knows which items still need converting', () => {
    expect(needsRichConversion('markdown', { text: 'x' })).toBe(true)
    expect(needsRichConversion('richtext', { html: 'x' })).toBe(true)
    expect(needsRichConversion('richtext', { doc: EMPTY_RICH_DOC })).toBe(false)
    expect(isRichDoc({ doc: EMPTY_RICH_DOC })).toBe(true)
    expect(isRichDoc({ html: '' })).toBe(false)
  })

  it('reads plain text with a line per block and tabs between table cells', () => {
    const doc = toRichDoc('markdown', { text: '# Head\n\nPara\n\n- a\n- b\n\n| A | B |\n| - | - |\n| 1 | 2 |' })
    expect(richContentToPlainText('richtext', { doc })).toBe('Head\nPara\na\nb\nA\tB\n1\t2')
  })
})
