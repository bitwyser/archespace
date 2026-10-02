/**
 * theme-init.js - Applies the saved theme before first paint to avoid a
 * light/dark flash of unstyled content (FOUC).
 *
 * Loaded as a blocking classic script in <head>, before the app bundle and
 * its stylesheet, so :root gets the right data-theme-mode / data-accent
 * attributes up front. CSP `script-src 'self'` allows this self-hosted file
 * (an inline script would be blocked).
 *
 * Keep in sync with src/context/ThemeCore.js + ThemeContext.jsx:
 * storage keys, valid ids, and defaults. ThemeContext re-applies these on
 * mount (and after loading the signed-in user's saved settings).
 */
(function () {
  try {
    var MODES = ['system', 'dark', 'light'];
    var ACCENTS = ['mint', 'lavender', 'amber', 'sky', 'rose'];
    var DEFAULT_MODE = 'system';
    var DEFAULT_ACCENT = 'mint';

    var mode = localStorage.getItem('arche-theme-mode');
    var accent = localStorage.getItem('arche-accent-color');

    if (MODES.indexOf(mode) === -1) mode = DEFAULT_MODE;
    if (ACCENTS.indexOf(accent) === -1) accent = DEFAULT_ACCENT;

    var resolved = mode;
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    var root = document.documentElement;
    root.setAttribute('data-theme-mode', resolved);
    root.setAttribute('data-accent', accent);
  } catch {
    // localStorage/matchMedia unavailable - leave the :root defaults (dark / mint).
  }
})();
