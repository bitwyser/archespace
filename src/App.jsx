/**
 * App.jsx - Root application component.
 */

import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useRouteError } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContextCore'
import { EncryptionProvider } from './context/EncryptionContext'
import VaultUnlockGate from './components/VaultUnlockGate'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { CommandPaletteProvider } from './context/CommandPaletteContext'
import { ShortcutsProvider } from './context/ShortcutsContext'
import { PageActionsProvider } from './context/PageActionsContext'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { useRouteMeta } from './hooks/useRouteMeta'

import ErrorBoundary from './components/ErrorBoundary'
import ErrorScreen from './components/ErrorScreen'
import AppChrome from './components/layout/AppChrome'
import AppShell from './components/layout/AppShell'
import { Spinner } from './components/ui/UI'

/**
 * Wrap React.lazy() so that a failed dynamic import (e.g. after a
 * redeployment that changed chunk hashes) triggers one automatic
 * page reload instead of crashing.  A sessionStorage flag prevents
 * infinite reload loops.
 */
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      const reloaded = sessionStorage.getItem('chunk_reload')
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
        // Return a never-resolving promise so React doesn't render while reloading
        return new Promise(() => {})
      }
      // Already retried once - surface the real error
      sessionStorage.removeItem('chunk_reload')
      throw error
    }),
  )
}

// Clear the flag on a successful page load so future deploys can retry again
sessionStorage.removeItem('chunk_reload')

const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'))
const PasswordResetPage = lazyWithRetry(() => import('./pages/PasswordResetPage'))
const HomePage = lazyWithRetry(() => import('./pages/HomePage'))
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'))
const SpacePage = lazyWithRetry(() => import('./pages/SpacePage'))
const RecycleBinPage = lazyWithRetry(() => import('./pages/RecycleBinPage'))
const ArchivePage = lazyWithRetry(() => import('./pages/ArchivePage'))
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'))

const queryClient = new QueryClient({
  // Realtime subscriptions keep the cache fresh, so a refetch on every window
  // focus is redundant work (each one re-decrypts every space/item). Rely on
  // staleTime + realtime instead.
  defaultOptions: {
    queries: { staleTime: 1000 * 30, retry: 1, refetchOnWindowFocus: false },
  },
})

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <Spinner size={24} />
    </div>
  )
}

function ProtectedRoute({ children, title }) {
  const { user, loading } = useAuth()
  useSessionTimeout()
  // App routes are private: keep them out of search results.
  useRouteMeta({ title, indexable: false })

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return (
    <VaultUnlockGate>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </VaultUnlockGate>
  )
}

function PublicRoute({ children, title }) {
  const { user, loading } = useAuth()
  useRouteMeta({ title, indexable: false })

  if (loading) return <PageLoader />
  if (user) return <Navigate to="/app" replace />
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  )
}

function HomeRoute() {
  const { user, loading } = useAuth()
  // The landing page is the only indexable route.
  useRouteMeta({ title: null, indexable: true })

  if (loading) return <PageLoader />
  if (user) return <Navigate to="/app" replace />
  return (
    <Suspense fallback={<PageLoader />}>
      <HomePage />
    </Suspense>
  )
}

/** Shell rendered inside RouterProvider so hooks like useNavigate() work in AppChrome. */
function RootLayout() {
  return (
    <>
      <AppChrome />
      <Outlet />
    </>
  )
}

/** React Router error boundary - renders when a route throws (including chunk-load failures). */
function RouteErrorBoundary() {
  const error = useRouteError()
  console.error('[RouteErrorBoundary]', error)

  const isChunkError =
    error?.message?.includes('dynamically imported module') ||
    error?.message?.includes('Failed to fetch')

  return (
    <ErrorScreen
      variant={isChunkError ? 'chunk' : 'error'}
      title={isChunkError ? 'App updated - reload needed' : 'Something went wrong'}
      message={isChunkError
        ? 'A new version of Arche was deployed. Please reload to get the latest update.'
        : 'An unexpected error occurred. Try reloading the page or going back to the dashboard.'}
      errorMessage={isChunkError ? undefined : error?.message}
    />
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/login', element: <PublicRoute title="Sign in"><LoginPage /></PublicRoute> },
      { path: '/reset-password', element: <Suspense fallback={<PageLoader />}><PasswordResetPage /></Suspense> },
      { path: '/', element: <HomeRoute /> },
      {
        element: <AppShell />,
        children: [
          { path: '/app', element: <ProtectedRoute title="Your spaces"><DashboardPage /></ProtectedRoute> },
          { path: '/space/:id', element: <ProtectedRoute><SpacePage /></ProtectedRoute> },
          { path: '/recycle-bin', element: <ProtectedRoute title="Recycle bin"><RecycleBinPage /></ProtectedRoute> },
          { path: '/archive', element: <ProtectedRoute title="Archive"><ArchivePage /></ProtectedRoute> },
          { path: '/settings', element: <ProtectedRoute title="Settings"><SettingsPage /></ProtectedRoute> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <ShortcutsProvider>
              <CommandPaletteProvider>
                <PageActionsProvider>
                  <AuthProvider>
                    <EncryptionProvider>
                      <RouterProvider router={router} />
                    </EncryptionProvider>
                  </AuthProvider>
                </PageActionsProvider>
              </CommandPaletteProvider>
            </ShortcutsProvider>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
