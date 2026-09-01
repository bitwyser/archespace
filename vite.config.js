import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

// Commit hash for the running build, so the deployed code can be checked
// against the public source. Prefers CI-provided env vars, falls back to git.
function resolveCommit() {
  const fromEnv =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Build timestamp derived from the commit (or SOURCE_DATE_EPOCH), never the wall
// clock, so a given commit always builds byte-for-byte identically (reproducible
// builds). Falls back to empty in a non-git checkout.
function resolveBuildTime() {
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch) return new Date(Number(epoch) * 1000).toISOString()
  try {
    return execSync('git log -1 --format=%cI').toString().trim()
  } catch {
    return ''
  }
}

// App version, sourced from the git tag so releases are driven purely by tagging
// (no manual package.json bump). Prefers the CI tag, then the nearest tag in
// history, and finally package.json for dev / no-tag builds. The leading "v" is
// stripped (the UI adds its own).
function resolveVersion() {
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME.replace(/^v/, '')
  }
  try {
    return execSync('git describe --tags --abbrev=0').toString().trim().replace(/^v/, '')
  } catch {
    return pkg.version
  }
}

// Canonical site origin used for absolute SEO URLs (canonical tag, Open Graph,
// sitemap, robots). Overridable per environment via VITE_SITE_URL; the trailing
// slash is stripped so paths join cleanly.
function resolveSiteUrl() {
  return (process.env.VITE_SITE_URL || 'https://archespace.app').replace(/\/+$/, '')
}
const siteUrl = resolveSiteUrl()

const robotsTxt = `User-agent: *
Allow: /
Disallow: /app
Disallow: /space
Disallow: /settings
Disallow: /archive
Disallow: /recycle-bin
Disallow: /login
Disallow: /reset-password

Sitemap: ${siteUrl}/sitemap.xml
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

// Substitutes {{SITE_URL}} in index.html and writes robots.txt / sitemap.xml
// into the build so the canonical origin lives in exactly one place.
function seoPlugin() {
  return {
    name: 'arche-seo',
    transformIndexHtml(html) {
      return html.replaceAll('{{SITE_URL}}', siteUrl)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(resolveVersion()),
    __BUILD_HASH__: JSON.stringify(resolveCommit()),
    __BUILD_TIME__: JSON.stringify(resolveBuildTime()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react'
          }
          if (id.includes('@tanstack/react-query')) return 'query'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('jszip')) return 'zip'
          return 'vendor'
        },
      },
    },
  },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          },
        },
      ],
    },
  }), cloudflare(), seoPlugin()],
})