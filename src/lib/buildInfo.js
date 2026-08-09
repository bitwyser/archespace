/**
 * buildInfo.js - Build provenance injected at compile time (see vite.config.js).
 *
 * Surfacing the commit hash lets users verify the code their browser is
 * running matches the audited, open-source release.
 */
/* global __APP_VERSION__, __BUILD_HASH__, __BUILD_TIME__ */

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'
export const BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

export const REPO_URL = 'https://github.com/patkarmandar/archespace'
export const COMMIT_URL = BUILD_HASH === 'dev' ? REPO_URL : `${REPO_URL}/commit/${BUILD_HASH}`

/** Companion Android app (Flutter), open source alongside the web app. */
export const MOBILE_REPO_URL = 'https://github.com/patkarmandar/archespace-mobile'
