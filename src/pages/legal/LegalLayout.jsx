/**
 * LegalLayout.jsx - Shared chrome for the public legal pages (privacy / terms):
 * a branded header, a titled document body, and cross-links + contact.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { WordmarkLogo } from '../../components/WordmarkLogo'

export function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-[100svh] bg-bg-base text-text-secondary">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="ArcheSpace home" className="flex items-center">
            <WordmarkLogo className="h-6 w-auto text-accent" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{title}</h1>
        {updated && <p className="mt-2 text-xs text-text-muted">Last updated: {updated}</p>}

        <div className="legal-prose mt-8 text-sm leading-relaxed">{children}</div>

        <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-bg-border pt-6 text-xs text-text-muted">
          <Link to="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-accent transition-colors">Terms of Service</Link>
          <a href="mailto:help@archespace.app" className="hover:text-accent transition-colors">help@archespace.app</a>
        </div>
      </main>
    </div>
  )
}
