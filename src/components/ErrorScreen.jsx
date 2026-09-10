/**
 * ErrorScreen.jsx - Shared full-page error / recovery UI.
 *
 * Used by both the React error boundary (ErrorBoundary) and the router error
 * boundary (RouteErrorBoundary in App.jsx). The `chunk` variant swaps the icon
 * and is used when a stale dynamic import fails after a redeploy.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorScreen({ variant = 'error', title, message, errorMessage }) {
  const isChunk = variant === 'chunk'

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-base text-text-primary">
      <div role="alert" className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-bg-surface border border-bg-border">
          {isChunk
            ? <RefreshCw size={24} className="text-accent" />
            : <AlertTriangle size={24} className="text-danger" />}
        </div>

        <h1 className="text-xl font-semibold">{title}</h1>

        <p className="text-sm text-text-secondary">
          {message}
        </p>

        {errorMessage && (
          <details className="text-left text-xs rounded-xl p-3 bg-bg-elevated border border-bg-border">
            <summary className="cursor-pointer font-medium text-text-secondary">
              Error details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-danger">
              {errorMessage}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-accent text-[#0c1a16]"
          >
            Reload page
          </button>
          <button
            onClick={() => { window.location.href = '/app' }}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-bg-surface border border-bg-border text-text-secondary"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
