/**
 * Toast notifications via a `useToast()` hook (toast.success/error/info).
 * Toasts auto-dismiss after 3s and stack in the bottom-right, max 5 at once
 * (oldest removed first).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { TOAST_DISMISS_MS, TOAST_ERROR_DISMISS_MS, MAX_TOASTS } from '../lib/constants'
import { ToastContext } from './ToastCore'

/** Icon + accent colour per toast type */
const TYPE_CONFIG = {
  success: { Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  error:   { Icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20'     },
  info:    { Icon: Info,          color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20'    },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Track timer IDs to clean up on unmount (prevents memory leaks)
  const timerMap = useRef(new Map())

  // ── Cleanup all timers on unmount ──
  useEffect(() => {
    const map = timerMap.current
    return () => {
      for (const timerId of map.values()) {
        clearTimeout(timerId)
      }
      map.clear()
    }
  }, [])

  /** Remove a single toast by id */
  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))

    // Remove from DOM after exit animation completes
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timerMap.current.delete(id)
      timerMap.current.delete(`${id}-remove`)
    }, 200)

    timerMap.current.set(`${id}-remove`, removeTimer)

    // Clear the auto-dismiss timer
    const existingTimer = timerMap.current.get(id)
    if (existingTimer) {
      clearTimeout(existingTimer)
      timerMap.current.delete(id)
    }
  }, [])

  /**
   * Show a toast notification.
   * @param {'success'|'error'|'info'} type
   * @param {string} message
   */
  const show = useCallback((type, message) => {
    const id = crypto.randomUUID()
    const duration = type === 'error' ? TOAST_ERROR_DISMISS_MS : TOAST_DISMISS_MS

    setToasts(prev => {
      // Trim oldest if we're at the limit
      const trimmed = prev.length >= MAX_TOASTS ? prev.slice(1) : prev
      return [...trimmed, { id, type, message, exiting: false, duration }]
    })

    // Auto-dismiss after delay
    const timerId = setTimeout(() => dismiss(id), duration)
    timerMap.current.set(id, timerId)
  }, [dismiss])

  /** Pause a toast's auto-dismiss while the pointer is over it */
  const pauseTimer = useCallback((id) => {
    const timerId = timerMap.current.get(id)
    if (timerId) {
      clearTimeout(timerId)
      timerMap.current.delete(id)
    }
  }, [])

  /** Restart auto-dismiss when the pointer leaves */
  const resumeTimer = useCallback((id, duration) => {
    if (timerMap.current.has(id)) return
    const timerId = setTimeout(() => dismiss(id), duration)
    timerMap.current.set(id, timerId)
  }, [dismiss])

  /** Convenience methods */
  const toast = {
    success: (msg) => show('success', msg),
    error:   (msg) => show('error', msg),
    info:    (msg) => show('info', msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* ── Toast stack (bottom-right, fixed) ── */}
      <div className="toast-stack fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(({ id, type, message, exiting, duration }) => {
          const { Icon, color, bg, border } = TYPE_CONFIG[type] || TYPE_CONFIG.info
          return (
            <div
              key={id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border ${border} ${bg} shadow-xl backdrop-blur-md ${
                exiting ? 'animate-slide-out' : 'animate-slide-in'
              }`}
              style={{ background: 'var(--glass-bg)' }}
              role={type === 'error' ? 'alert' : 'status'}
              aria-live={type === 'error' ? 'assertive' : 'polite'}
              onMouseEnter={() => pauseTimer(id)}
              onMouseLeave={() => resumeTimer(id, duration)}
            >
              <Icon size={20} className={`${color} shrink-0`} />
              <span className="flex-1 text-sm text-text-primary">{message}</span>
              <button
                onClick={() => dismiss(id)}
                className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
