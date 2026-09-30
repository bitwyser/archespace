// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { richTextExtensions } from './extensions'

function editorWith(markdown) {
  return new Editor({ extensions: richTextExtensions(), content: markdown, contentType: 'markdown' })
}
const text = (editor) => editor.state.doc.textContent
const results = (editor) => editor.storage.searchReplace.results.length

describe('find and replace', { timeout: 20000 }, () => {
  it('finds matches, ignoring case unless asked', () => {
    const editor = editorWith('Cat cat CAT\n\nconcat')
    editor.commands.setSearch({ term: 'cat' })
    expect(results(editor)).toBe(4)
    editor.commands.setSearch({ term: 'cat', caseSensitive: true })
    expect(results(editor)).toBe(2)
    editor.commands.setSearch({ term: 'cat', caseSensitive: false, wholeWord: true })
    expect(results(editor)).toBe(3)
    editor.destroy()
  })

  it('steps through matches and wraps around', () => {
    const editor = editorWith('a b a b a')
    editor.commands.setSearch({ term: 'a', wholeWord: false, caseSensitive: false })
    const storage = editor.storage.searchReplace
    expect(storage.index).toBe(0)
    editor.commands.nextMatch()
    editor.commands.nextMatch()
    expect(storage.index).toBe(2)
    editor.commands.nextMatch()
    expect(storage.index).toBe(0)
    editor.commands.previousMatch()
    expect(storage.index).toBe(2)
    editor.destroy()
  })

  it('replaces one match or all, keeping the text around them', () => {
    const editor = editorWith('red, red and **red**')
    editor.commands.setSearch({ term: 'red', replace: 'blue' })
    editor.commands.replaceMatch()
    expect(text(editor)).toBe('blue, red and red')
    editor.commands.replaceAllMatches()
    expect(text(editor)).toBe('blue, blue and blue')
    // Bold stays on the replaced word.
    expect(JSON.stringify(editor.getJSON())).toContain('"marks":[{"type":"bold"}],"text":"blue"')
    editor.destroy()
  })

  it('supports regular expressions with $1 groups, and flags invalid ones', () => {
    const editor = editorWith('2024-01-05 and 2025-12-31')
    editor.commands.setSearch({ term: '(\\d{4})-\\d{2}-\\d{2}', regex: true, replace: 'year $1' })
    expect(results(editor)).toBe(2)
    editor.commands.replaceAllMatches()
    expect(text(editor)).toBe('year 2024 and year 2025')
    editor.commands.setSearch({ term: '(', regex: true })
    expect(editor.storage.searchReplace.invalid).toBe(true)
    expect(results(editor)).toBe(0)
    editor.destroy()
  })

  it('sets line spacing on the selected paragraph, and resets it', () => {
    const editor = editorWith('first\n\nsecond')
    editor.commands.setTextSelection(2)
    expect(editor.commands.setLineHeight('1.8')).toBe(true)
    expect(editor.getJSON().content[0].attrs.lineHeight).toBe('1.8')
    expect(editor.getJSON().content[1].attrs.lineHeight).toBeNull()
    expect(editor.commands.setLineHeight('7')).toBe(false) // not an offered value
    editor.commands.setLineHeight(null)
    expect(editor.getJSON().content[0].attrs.lineHeight).toBeNull()
    editor.destroy()
  })

  it('never saves search highlights into the note', () => {
    const editor = editorWith('find me')
    editor.commands.setSearch({ term: 'find', regex: false })
    expect(JSON.stringify(editor.getJSON())).not.toContain('search')
    editor.destroy()
  })
})
