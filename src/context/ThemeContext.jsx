/**
 * ThemeContext.jsx - Appearance provider for ArcheSpace.
 *
 * Keeps theme mode and accent color available before login through localStorage,
 * then syncs them to the signed-in user's `user_settings` row when available.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_THEME_MODE,
  THEME_MODES,
  ThemeContext,
} from './ThemeCore'

const STORAGE_THEME_MODE = 'arche-theme-mode'
const STORAGE_ACCENT_COLOR = 'arche-accent-color'
const LEGACY_THEME_STORAGE = 'arche-theme'

const VALID_THEME_MODES = new Set(THEME_MODES.map(mode => mode.id))
const VALID_ACCENT_COLORS = new Set(ACCENT_COLORS.map(color => color.id))

function normalizeThemeMode(value) {
  return VALID_THEME_MODES.has(value) ? value : DEFAULT_THEME_MODE
}

function normalizeAccentColor(value) {
  return VALID_ACCENT_COLORS.has(value) ? value : DEFAULT_ACCENT_COLOR
}

function getStoredAppearance() {
  const legacyTheme = localStorage.getItem(LEGACY_THEME_STORAGE)
  return {
    themeMode: normalizeThemeMode(localStorage.getItem(STORAGE_THEME_MODE) || legacyTheme),
    accentColor: normalizeAccentColor(localStorage.getItem(STORAGE_ACCENT_COLOR) || legacyTheme),
  }
}

function getSystemThemeMode() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

async function saveUserAppearance(userId, appearance) {
  if (!userId) return
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      theme_mode: appearance.themeMode,
      accent_color: appearance.accentColor,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.warn('[Arche] Failed to save user appearance settings:', error.message)
  }
}

export function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(getStoredAppearance)
  const [systemThemeMode, setSystemThemeMode] = useState(getSystemThemeMode)
  const resolvedThemeMode = appearance.themeMode === 'system' ? systemThemeMode : appearance.themeMode
  const userIdRef = useRef(null)
  const appearanceRef = useRef(appearance)

  useEffect(() => {
    appearanceRef.current = appearance
    localStorage.setItem(STORAGE_THEME_MODE, appearance.themeMode)
    localStorage.setItem(STORAGE_ACCENT_COLOR, appearance.accentColor)
    document.documentElement.setAttribute('data-theme-mode', resolvedThemeMode)
    document.documentElement.setAttribute('data-accent', appearance.accentColor)
  }, [appearance, resolvedThemeMode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const updateSystemTheme = event => setSystemThemeMode(event.matches ? 'light' : 'dark')
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    let active = true

    const applyUserSettings = async (session) => {
      const nextUserId = session?.user?.id ?? null
      userIdRef.current = nextUserId
      if (!nextUserId) return

      const { data, error } = await supabase
        .from('user_settings')
        .select('theme_mode, accent_color')
        .eq('user_id', nextUserId)
        .maybeSingle()

      if (!active || userIdRef.current !== nextUserId) return

      if (error) {
        console.warn('[Arche] Failed to load user appearance settings:', error.message)
        return
      }

      if (data) {
        setAppearance({
          themeMode: normalizeThemeMode(data.theme_mode),
          accentColor: normalizeAccentColor(data.accent_color),
        })
        return
      }

      await saveUserAppearance(nextUserId, appearanceRef.current)
    }

    supabase.auth.getSession().then(({ data: { session } }) => applyUserSettings(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUserSettings(session)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const updateAppearance = useCallback((partial) => {
    const current = appearanceRef.current
    const next = {
      themeMode: normalizeThemeMode(partial.themeMode ?? current.themeMode),
      accentColor: normalizeAccentColor(partial.accentColor ?? current.accentColor),
    }
    appearanceRef.current = next
    setAppearance(next)
    saveUserAppearance(userIdRef.current, next)
  }, [])

  const setThemeMode = useCallback(
    (themeMode) => updateAppearance({ themeMode }),
    [updateAppearance]
  )

  const setAccentColor = useCallback(
    (accentColor) => updateAppearance({ accentColor }),
    [updateAppearance]
  )

  const toggleThemeMode = useCallback(() => {
    const current = appearanceRef.current
    const currentIndex = THEME_MODES.findIndex(option => option.id === current.themeMode)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEME_MODES.length
    updateAppearance({ themeMode: THEME_MODES[nextIndex].id })
  }, [updateAppearance])

  const value = useMemo(() => ({
    themeMode: appearance.themeMode,
    resolvedThemeMode,
    themeModes: THEME_MODES,
    setThemeMode,
    accentColor: appearance.accentColor,
    accentColors: ACCENT_COLORS,
    setAccentColor,
    toggleThemeMode,
    // Backward-compatible aliases for older call sites.
    theme: appearance.themeMode,
    themes: THEME_MODES,
    setTheme: setThemeMode,
    toggle: toggleThemeMode,
  }), [appearance, resolvedThemeMode, setAccentColor, setThemeMode, toggleThemeMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
