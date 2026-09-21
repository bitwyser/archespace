<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/archespace-logo.svg">
    <img alt="ArcheSpace" src="public/archespace-logo-light.svg" width="320">
  </picture>
</p>

[![CI](https://github.com/bitwyser/archespace/actions/workflows/ci.yml/badge.svg)](https://github.com/bitwyser/archespace/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/bitwyser/archespace)](https://github.com/bitwyser/archespace/releases)
[![Live](https://img.shields.io/badge/live-archespace.app-32d3aa)](https://archespace.app)

ArcheSpace is an open source, encrypted workspace for organizing everything you're working on. Group your information, knowledge, projects, notes, secrets, code, checklists, and ideas into spaces, and fill each space with the content type that fits: notes, rich text and markdown, checklists and lists, tables, code snippets, drawings, PIN-protected secrets, and even two-factor (TOTP) codes. Everything is taggable, searchable, and kept in one place across your devices.

Privacy is built in, not bolted on. ArcheSpace is a self-hostable web app with Supabase sync and a client-side encrypted vault, so your content stays private even from the app's owner and developers. It follows a zero-knowledge architecture: everything is encrypted in your browser and the backend only ever stores ciphertext, so the server, its operators, and the developers never see your data in readable form.

A companion Android/Flutter app lives in a [separate repository](https://github.com/bitwyser/archespace-mobile).

## Features

- **Spaces** for separating projects and ideas, with one level of nesting (sub-spaces), tags, pinning, and drag-and-drop or keyboard reordering.
- **Many item types** for different kinds of content, from notes to a built-in authenticator (see [Item types](#item-types)).
- **Grid or list views**, per-view sort (default / name / newest), and a unified search across spaces, tags, and item content.
- **Command palette** (`Ctrl/Cmd+K`) and keyboard shortcuts throughout; press `?` for the in-app list.
- **Auto-save**, one-click copy, bulk actions, and duplicate / move / archive / restore / delete workflows.
- **Archive** and a **recycle bin** (restore or permanently delete).
- **PDF export** of a whole space or a single item, with a branded header, footer URL, and page numbers.
- **JSON backup** import and export.
- **Appearance**: System / Dark / Light modes and five accent colors (mint, lavender, amber, sky, rose).
- **Encrypted vault** with configurable auto-lock and optional passkey / biometric unlock (see [Security](#security)).
- **Optional two-factor sign-in** (TOTP) with a one-time backup code.
- **Offline mode**: read and edit item text from an encrypted on-device cache; changes sync when you reconnect.
- **PWA install**, full keyboard operation, and accessibility throughout.
- Single-user self-hosting by default, with an optional multi-user mode.

## Item types

| Type | Description |
|------|-------------|
| Note | Free-form plain text. |
| Rich Text | Formatted text (bold, italic, underline, font size) stored as sanitised HTML. |
| Markdown | Markdown with click-to-edit preview. |
| List / Numbered List | Bullet or automatically numbered lists. |
| Checklist | Checkboxes with progress tracking. |
| Cards | Title and description pairs for planning. |
| Table | Rows and columns; copies as tab-separated values for spreadsheets. |
| Secret | PIN-protected text; the content is hidden until you re-enter your vault PIN. |
| Drawing | Freehand vector sketch with pen, colours, and sizes. |
| Code | Monospace snippet with automatic syntax highlighting. |
| Authenticator | On-device TOTP codes with live countdowns; secrets are encrypted in your vault. |

All list-style types support add, remove, and drag-and-drop or `Arrow Up` / `Arrow Down` reordering.

## Security

You sign in with Supabase Auth (login password), then unlock a separate vault **PIN or passphrase** to access your data. The password proves account ownership; the PIN protects the content.

- **Client-side encryption.** Space and item content is encrypted in the browser with AES-GCM before it reaches Supabase; only non-sensitive metadata (IDs, timestamps, positions, flags) is stored in plain form. The server, its operators, and developers never see readable content.
- **Key derivation.** A random vault master key is wrapped with a key derived from your PIN using Argon2id (memory-hard). The PIN is never stored. Older PBKDF2 vaults upgrade automatically on the next PIN change.
- **Sessions.** The unlocked key is a non-extractable key in the browser, auto-locks after a configurable idle period (default 24h), and clears on sign-out. Login sessions last a week; "sign out of all devices" revokes every session. Failed login and PIN attempts are rate limited, and repeated PIN failures lock the vault server-side. Supabase Row Level Security restricts each user to their own rows.
- **Passkey / biometric unlock.** Optionally unlock with Face ID, Touch ID, or Windows Hello via the WebAuthn PRF extension. The wrapped key stays on-device (browser IndexedDB), never on the server; the PIN and recovery code remain fallbacks.
- **Two-factor (2FA).** Optional TOTP, off by default. When on, sign-in asks for the code after the password and before the vault, and RLS enforces AAL2 on the content tables so it can't be bypassed via the API.
- **Recovery.** A one-time recovery code is shown once at vault setup and can reset a forgotten PIN. If **both** the PIN and recovery code are lost, the vault can be reset by re-entering your account password, which wipes the (unrecoverable) encrypted data and starts a fresh vault. There is no backdoor.
- **Audit log.** An owner-only `audit_log` records authentication and security events (never content), written only by `SECURITY DEFINER` triggers and a whitelisted RPC.

**Privacy & legal.** Accepting the Terms of Service and Privacy Policy is required at sign-up and recorded server-side. The policies are served at `/privacy` and `/terms`. To report a vulnerability, see [SECURITY.md](SECURITY.md) (and `/.well-known/security.txt`).

## Setup

```bash
git clone https://github.com/bitwyser/archespace
cd archespace
npm install
```

1. **Supabase**: create a project, run `schema.sql` in the SQL Editor, enable the Email auth provider, and configure Resend as the SMTP server. Paste the templates from `email-templates/` into Auth → Email Templates, and add your app URL plus `https://your-domain/reset-password` to the redirect URLs.
2. **Account-deletion email** (server-side, via `pg_net` + Resend): enable `pg_net` (included in `schema.sql`), store your key with `select vault.create_secret('re_your_key', 'RESEND_API_KEY');`, and set the `v_from` / `v_support` addresses in `notify_account_deleted()` to a verified domain.
3. **Environment**: create `.env`:

   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Mode**: single-user is the default (create one user, keep sign-up disabled). For multi-user, set `VITE_ALLOW_SIGNUP=true`, enable Auth email sign-ups, and tighten the rate limits.

```bash
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the build locally (Wrangler)
```

Deploys are automatic on Cloudflare's Git-connected builds: pushing to `main` runs `npm ci && npm run build` and deploys `dist/`. Any static host works too: build and serve `dist/` with an SPA fallback to `index.html` (`dist/404.html` is generated for hosts that need one).

## Tech stack

React 19 + React Router 7, Vite 8 (+ PWA), Tailwind CSS 3, and TanStack Query on the frontend. Supabase (Auth, PostgreSQL, RLS, Realtime) on the backend, with `pg_net` + the Resend HTTP API for the account-deletion email and Resend SMTP for auth emails. Encryption uses the Web Crypto API (AES-GCM) with Argon2id via `@noble/hashes`. Also: Lucide icons, `perfect-freehand` (drawing), `highlight.js` (code), JSZip, and pdfmake (PDF export). Hosted on Cloudflare; CI via GitHub Actions (lint, test, build, audit) with Vitest and Dependabot.

## Releases

The app version is derived from the git tag at build time, so a release needs no manual bump. Just tag and push:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

Tagged releases are built reproducibly and published to GitHub Releases with SHA-256 checksums signed by [cosign](https://github.com/sigstore/cosign) (keyless, via GitHub OIDC), so anyone can verify what a tag builds to. Settings shows the running build's commit, linked to GitHub. See the release workflow for the `cosign verify-blob` and reproducible-build steps.

## Contributing

Contributions are welcome: bug fixes, features, docs, and translations.

- Fork, branch off `main`, and open a focused pull request.
- Run `npm run lint`, `npm test`, and `npm run build` before submitting.
- For larger changes, schema changes, or security-relevant work, open an issue first.

Development questions: **[bitwyser@archespace.app](mailto:bitwyser@archespace.app)**.

## Support

Need help with setup, self-hosting, or account/vault recovery? Email **[help@archespace.app](mailto:help@archespace.app)** (include what you were doing, your deployment type, host, browser/OS, and any redacted errors), or open an issue for bugs and feature requests.

## License

See [LICENSE](LICENSE). Crafted and maintained by BitWyser.
