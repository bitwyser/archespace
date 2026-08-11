import { describe, it, expect } from 'vitest'
import { markdownToHtml } from './MarkdownPreview'

describe('markdownToHtml - XSS hardening', () => {
  it('escapes raw HTML tags', () => {
    const out = markdownToHtml('<script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).toContain('&lt;script&gt;')
  })

  it('neutralizes event-handler injection', () => {
    const out = markdownToHtml('<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<img')
    expect(out.toLowerCase()).not.toContain('onerror=')
  })

  it('blocks javascript: URLs in links', () => {
    const out = markdownToHtml('[x](javascript:alert(1))')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('href="#"')
  })

  it('blocks obfuscated / padded javascript: URLs', () => {
    expect(markdownToHtml('[x](JaVaScRiPt:alert(1))')).toContain('href="#"')
    expect(markdownToHtml('[x](  javascript:alert(1) )')).toContain('href="#"')
  })

  it('blocks data: URLs', () => {
    expect(markdownToHtml('[x](data:text/html,payload)')).toContain('href="#"')
  })
})

describe('markdownToHtml - rendering', () => {
  it('allows safe https links with rel/target', () => {
    const out = markdownToHtml('[docs](https://example.com)')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('renders basic formatting', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>')
    expect(markdownToHtml('# Title')).toContain('md-h1')
  })

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })
})
