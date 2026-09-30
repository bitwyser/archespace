/**
 * searchReplace.js - Find and replace inside a Rich text note.
 *
 * Matches are shown as decorations (display only: nothing is saved into the
 * note). Options live in the extension's storage; commands update them and
 * step or replace through the matches. Matching runs per text block, so a
 * match never spans two paragraphs; inline nodes like line breaks break it.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const searchKey = new PluginKey('searchReplace')

// Per editor: what Mod-f does (open the toolbar's search panel), if anything.
const openers = new WeakMap()

/** Let Mod-f in `editor` open a search UI; returns an unregister function. */
export function registerSearchOpener(editor, open) {
  openers.set(editor, open)
  return () => { if (openers.get(editor) === open) openers.delete(editor) }
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The search as a global RegExp, or null (empty or invalid pattern). */
function buildPattern({ term, caseSensitive, wholeWord, regex }) {
  if (!term) return null
  let source = regex ? term : escapeRegExp(term)
  if (wholeWord) source = `\\b(?:${source})\\b`
  try {
    return new RegExp(source, caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

/** Every match in the document as { from, to } positions. */
function findMatches(doc, pattern) {
  const results = []
  if (!pattern) return results
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ''
    const map = [] // string index -> document position
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (child.isText) {
        for (let i = 0; i < child.text.length; i++) map.push(start + i)
        text += child.text
      } else {
        map.push(start)
        text += '\u0000' // a line break or other inline node
      }
    })
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) {
      if (m[0].length === 0) { pattern.lastIndex++; continue }
      results.push({ from: map[m.index], to: map[m.index + m[0].length - 1] + 1 })
    }
    return false
  })
  return results
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addStorage() {
    return {
      term: '',
      replace: '',
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      /** True when regex mode is on and the pattern doesn't compile. */
      invalid: false,
      results: [],
      index: 0,
    }
  },

  addCommands() {
    const storage = this.storage
    const refresh = (tr, dispatch) => {
      if (dispatch) dispatch(tr.setMeta(searchKey, true))
      return true
    }
    // Select a match and scroll it into view.
    const goTo = (tr, dispatch) => {
      const match = storage.results[storage.index]
      if (match) {
        tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView()
      }
      return refresh(tr, dispatch)
    }
    return {
      setSearch: (options) => ({ tr, dispatch }) => {
        Object.assign(storage, options)
        storage.index = 0
        return refresh(tr, dispatch)
      },
      nextMatch: () => ({ tr, dispatch }) => {
        if (!storage.results.length) return false
        storage.index = (storage.index + 1) % storage.results.length
        return goTo(tr, dispatch)
      },
      previousMatch: () => ({ tr, dispatch }) => {
        if (!storage.results.length) return false
        storage.index = (storage.index - 1 + storage.results.length) % storage.results.length
        return goTo(tr, dispatch)
      },
      /** Replace the current match, then move to the next one. */
      replaceMatch: () => ({ tr, dispatch }) => {
        const match = storage.results[storage.index]
        if (!match) return false
        if (dispatch) {
          tr.insertText(replacementFor(tr.doc.textBetween(match.from, match.to), storage), match.from, match.to)
          dispatch(tr.setMeta(searchKey, true))
        }
        return true
      },
      replaceAllMatches: () => ({ tr, dispatch }) => {
        if (!storage.results.length) return false
        if (dispatch) {
          // Back to front, so earlier positions stay valid.
          for (const match of [...storage.results].reverse()) {
            tr.insertText(replacementFor(tr.doc.textBetween(match.from, match.to), storage), match.from, match.to)
          }
          storage.index = 0
          dispatch(tr.setMeta(searchKey, true))
        }
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Only when a search UI is attached (else the browser's own find).
      'Mod-f': () => {
        const open = openers.get(this.editor)
        if (!open) return false
        open()
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old, _oldState, newState) {
            if (!tr.docChanged && !tr.getMeta(searchKey)) return old.map(tr.mapping, tr.doc)
            const pattern = buildPattern(storage)
            storage.invalid = !!(storage.term && storage.regex && !pattern)
            storage.results = findMatches(newState.doc, pattern)
            if (storage.index >= storage.results.length) storage.index = 0
            return DecorationSet.create(newState.doc, storage.results.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === storage.index ? 'search-match search-match-current' : 'search-match',
              })
            ))
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state),
        },
      }),
    ]
  },
})

/**
 * The text that replaces one match. In regex mode `$1`-style groups work;
 * otherwise the replacement is used as typed.
 */
function replacementFor(matched, storage) {
  if (!storage.regex) return storage.replace
  const pattern = buildPattern(storage)
  if (!pattern) return storage.replace
  return matched.replace(new RegExp(pattern.source, pattern.flags.replace('g', '')), storage.replace)
}
