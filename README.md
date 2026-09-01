# ArcheSpace

[![CI](https://github.com/bitwyser/archespace/actions/workflows/ci.yml/badge.svg)](https://github.com/bitwyser/archespace/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/bitwyser/archespace)](https://github.com/bitwyser/archespace/releases)
[![Live](https://img.shields.io/badge/live-archespace.app-32d3aa)](https://archespace.app)

ArcheSpace is an open source, private, encrypted space to organize everything you are working on. It is built as a self-hostable web app with Supabase sync and a client-side encrypted vault, ensuring that your saved content stays private even from the application owner and developers.

It follows a zero-knowledge architecture: your content is encrypted in the browser and the backend only ever stores ciphertext, so the server, its operators, and the developers never see your data in readable form.

## Table of contents

- [Features](#features)
- [Item types](#item-types)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Security model](#security-model)
- [Audit logging](#audit-logging)
- [Setup](#setup)
- [Email templates](#email-templates)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Deployment notes](#deployment-notes)
- [Release verification](#release-verification)
- [Roadmap](#roadmap)
- [Help and support](#help-and-support)
- [Contributing and development](#contributing-and-development)
- [Credits](#credits)
- [License](#license)

## Features

- Multiple spaces for separating ideas, projects, plans, references, and personal systems.
- Multiple item types for different kinds of content, including PIN-protected secrets (see [Item types](#item-types)).
- Pinning for important spaces and items.
- Drag-and-drop reordering for spaces and page items, plus keyboard reordering inside lists.
- Sort spaces and page items by default order, name, or newest, with the choice remembered per view.
- Grid or list view for spaces on the dashboard, and for items inside a space (grid uses a masonry layout so items keep their natural height).
- Unified dashboard search across spaces, tags, and item content, with keyboard navigation and jump-to-item.
- Command palette with `Ctrl+K` / `Cmd+K`.
- Keyboard shortcuts for common actions, with an in-app shortcuts dialog (see [Keyboard shortcuts](#keyboard-shortcuts)).
- Auto-save for edited items.
- One-click copy of any item's content to the clipboard as clean plain text.
- Bulk actions for spaces and items.
- Duplicate, move, archive, restore, and delete workflows.
- Archive area for hiding content without deleting it.
- Recycle bin with restore and permanent delete.
- Export a whole space or a single item to PDF via the browser's print dialog.
- Backup import/export to JSON.
- Appearance settings with `System`, `Dark`, and `Light` theme modes.
- Accent color settings with multiple color options.
- Private, encrypted vault to keep your content secure (see [Security model](#security-model)).
- Configurable vault auto-lock that re-locks the vault after a chosen period of inactivity (see [Security model](#security-model)).
- Passkey / biometric vault unlock using WebAuthn - unlock with Face ID, Touch ID, or Windows Hello alongside your PIN; the wrapped key is stored on-device (browser IndexedDB), never on the server (see [Security model](#security-model)).
- Optional two-factor authentication (TOTP) for sign-in, with a one-time backup code, enabled per account from Settings (see [Security model](#security-model)).
- Owner-only audit log of authentication and security events (see [Audit logging](#audit-logging)).
- Offline queue for pending changes while the browser is offline.
- Single-user self-hosting mode by default, with an optional multi-user mode.
- PWA support for installing as an app.
- Verifiable build hash shown in Settings, linking to the exact source commit on GitHub.
- Accessibility throughout: full keyboard operation (cards, menus, command palette, and search), a visible focus indicator, screen-reader live regions.

## Item types

| Type | Description |
|------|-------------|
| Note | Free-form plain text. |
| Markdown | Rich text with markdown formatting and click-to-edit preview. |
| List | Simple bullet list. |
| Numbered List | Ordered list with automatic numbering that updates as rows are added, removed, or reordered. |
| Checklist | Items with checkboxes and progress tracking. |
| Cards | Title and description pairs for planning and grouping ideas. |
| Table | Rows and columns of text with a header row. Copies as tab-separated values that paste straight into a spreadsheet. |
| Secret | PIN-protected text: the title stays visible, but the content is hidden and requires re-entering your vault PIN to view or edit. |
| Drawing | Freehand vector sketch or diagram, drawn with pen, colours, and sizes. |
| Code | A code snippet in a monospace block with automatic syntax highlighting (language auto-detected). Copies as plain text. |

All list-style types support adding, removing, drag-and-drop reordering, and keyboard reordering with `Arrow Up` / `Arrow Down`.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Show the keyboard shortcuts dialog |
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `/` | Focus dashboard search |
| `N` | Create a new space on the dashboard |
| `I` | Create a new item inside a space |
| `Ctrl+L` / `Cmd+L` | Lock the vault |
| `Ctrl+S` / `Cmd+S` | Save all dirty items on the current page |
| `Esc` | Close menus, modals, or active overlays |
| `Arrow Up` / `Arrow Down` | Reorder the focused row inside a list, numbered list, checklist, or card list |

## Security model

ArcheSpace uses a browser-side vault model. You sign in with Supabase Auth using a login password, then unlock a separate vault PIN or passphrase to access encrypted data - the password proves account ownership, the PIN or passphrase protects the content itself.

**Encryption**

- Space and item content (names, descriptions, tags, titles, and content) is encrypted client-side with AES-GCM before it reaches Supabase. Only non-sensitive metadata - IDs, timestamps, positions, and flags like pinned/archived/deleted - stays in plain form.
- The vault secret is never stored as plaintext. It can be a numeric PIN or a longer passphrase (letters, numbers, or symbols), so you can trade convenience for strength. On setup, the browser generates a random vault master key, which is wrapped with a key derived from your PIN or passphrase using Argon2id, a memory-hard key-derivation function that resists offline brute-forcing. Vaults created before Argon2id support was added continue to use PBKDF2 and are upgraded to Argon2id automatically the next time the PIN or passphrase is changed.
- Because encryption happens client-side, stored content is not readable by developers or app owners from the database.

**Sessions and access**

- The unlocked vault key is held as a non-extractable key in IndexedDB - usable for decryption within the tab but not readable or exportable by scripts - and auto-locks after a configurable period of inactivity (5 minutes, 15 minutes, 1 hour, 8 hours, 24 hours, or never), defaulting to 24 hours and adjustable in Settings.
- The login session has an absolute lifetime of 1 week.
- Signing out ends only the current device's session by default; Settings also offers "Sign out of all devices" to revoke every session at once. The absolute session timeout is likewise per-device.
- Password reset and password change flows globally sign out existing sessions.
- Failed login attempts and failed vault PIN attempts are rate limited, and repeated PIN failures lock the vault server-side.
- Supabase Row Level Security restricts each user to their own rows.

**Passkey / biometric unlock**

- You can enroll platform passkeys (Face ID, Touch ID, Windows Hello) from Settings to unlock the vault with biometrics instead of typing your PIN. The PIN and recovery code always remain as fallbacks.
- This uses the WebAuthn PRF extension: the passkey emits a stable, high-entropy secret (released only after biometric/user verification) that is HKDF-derived into a wrapping key and used to store an additional wrapped copy of the vault master key. The PRF secret and master key never leave the device.
- Nothing is sent to the server: the wrapped master key, credential ID, and non-secret salt are stored locally in the browser (IndexedDB), scoped per account. None of it can decrypt anything without the enrolled device's passkey. Clearing browser data (or using another browser) just falls back to the PIN.
- One passkey per browser: enabling biometric unlock on a browser replaces any previous one there, and you can disable it from Settings. Each browser (or device) enrolls its own, since storage is local. Changing your PIN re-wraps the same master key, so an enrolled passkey keeps working without re-enrollment.
- After setting up a PIN or unlocking with one, the app offers to enable biometric unlock when the device supports it and no passkey is enrolled yet. Availability is feature-detected, so the option is hidden where WebAuthn platform authenticators or PRF are unavailable.

**Two-factor authentication (2FA)**

- Optional TOTP two-factor authentication can be enabled per account from Settings, under Account. It is off by default for every existing and new account; each user opts in manually.
- Enrolment uses Supabase's native MFA: scan the QR code (or enter the key) into an authenticator app such as Google Authenticator, Authy, or 1Password. The TOTP secret is held only by Supabase Auth and is never stored in a client-readable table, so 2FA still protects the account if the login password is compromised.
- When 2FA is on, sign-in asks for the authenticator code after the password and before the vault unlock, so the order is login password, then 2FA, then vault PIN.
- Row Level Security enforces this at the database as well: once a verified factor exists, the encrypted content tables (`spaces`, `space_items`) are only readable after the second factor is verified (AAL2), so 2FA cannot be bypassed for your content by calling the API directly. `user_encryption` is intentionally left readable (it holds only wrapped ciphertext, useless without the vault PIN) so the vault-exists check stays reliable, and vault setup refuses to overwrite an existing vault. Accounts without 2FA are unaffected.
- A one-time backup code is shown once when 2FA is enabled, and can be regenerated from Settings. Only its SHA-256 hash is stored. The backup code can be used at sign-in if the authenticator is lost; using it removes the factor so you can sign in and set 2FA up again. (One code is enough because redeeming it disables 2FA.)
- Disabling 2FA requires re-entering the login password.

**Recovery**

- A one-time recovery code is generated during initial vault setup and shown once in the app - it is not emailed, so it must be saved when shown.
- The recovery code can be recreated from Settings by entering the current vault PIN.
- If the PIN is forgotten, the "Forgot PIN" flow uses the recovery code to set a new vault PIN.
- Resetting with a recovery code generates a new recovery code and invalidates the previous one.

**Account deletion**

- Deleting an account permanently removes the user and, by cascade, all of their spaces, items, and encrypted vault data.
- A confirmation email is sent automatically after deletion, server-side, using the Resend HTTP API. The Resend API key is stored encrypted in Supabase Vault and never reaches the browser.

**Limits to be aware of**

- The app cannot recover encrypted content without either the current vault PIN or the current recovery code - there's no backdoor.
- If both the vault PIN and recovery code are lost, encrypted space data cannot be decrypted.
- JSON exports are downloaded to your machine and should be stored carefully; imported backups are encrypted before upload.
- Client-side encryption is only as safe as the code your browser runs - a tampered build or malicious dependency could bypass it. Self-hosting, HTTPS, and reviewed dependencies reduce this, and Settings shows the exact build commit (linked to GitHub) so you can verify the running code.

## Audit logging

ArcheSpace keeps an owner-only `audit_log` table for authentication and security events. It is deliberately scoped:

- **Auth events only.** Space and item content is never written to the audit log.
- **Owner-only access.** Row Level Security has no policies and table grants are revoked, so end users cannot read or write it directly. Writes come only from `SECURITY DEFINER` triggers and a whitelisted RPC. The app owner reads it from the Supabase dashboard or with the service role.
- **Survives deletion.** The `user_id` foreign key is `ON DELETE SET NULL`, so history is retained after an account is removed.

Recorded actions include: `account_created`, `account_deleted`, `email_change`, `password_reset_requested` (server-side, via triggers on `auth.users`), and `login`, `logout`, `password_change`, `password_reset`, `vault_setup`, `vault_unlock`, `vault_lock`, `vault_pin_change`, `vault_pin_reset`, `recovery_code_created`, `vault_passkey_enroll`, `vault_passkey_remove`, `export`, `import` (client-side, via the `log_client_event` RPC).

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/bitwyser/archespace
cd archespace
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create and configure a Supabase project

1. Create a Supabase project.
2. Run the full `schema.sql` file in the Supabase SQL Editor.
3. Enable the Email provider in Supabase Auth.
4. Configure Resend as the SMTP server in Supabase Auth for password reset and auth emails.
5. Paste the branded email templates from `email-templates/` into Supabase Auth (see [Email templates](#email-templates)).
6. Add your deployed app URL to Supabase Auth redirect URLs.
7. Add `https://your-domain/reset-password` to Supabase Auth redirect URLs for password reset links.
8. Keep Supabase Auth sign-in rate limits at `30/hour per IP` or lower for production.

### 4. Enable the account-deletion email

The deletion confirmation email is sent from a Postgres trigger using the Resend HTTP API, with the key stored in Supabase Vault:

1. Enable the `pg_net` extension (the statement is included in `schema.sql`, or enable it under Database → Extensions).
2. Store your Resend API key in Vault (run once in the SQL Editor; do not commit the key):

   ```sql
   select vault.create_secret('re_your_real_key', 'RESEND_API_KEY');
   ```

3. In `schema.sql`, set the `v_from` and `v_support` addresses in `notify_account_deleted()` to a domain you have verified in Resend.

### 5. Configure environment variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Choose single-user or multi-user mode

**Single-user mode** is the default - create one user in the Supabase Auth dashboard and keep public sign-up disabled.

**Multi-user mode** is optional. To enable it:

```env
VITE_ALLOW_SIGNUP=true
```

or:

```env
VITE_MULTI_USER=true
```

Also enable Supabase Auth email sign-ups, tighten sign-up and password-reset rate limits, and verify RLS policies before public deployment.

### 7. Run the app

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Preview the production build locally (Wrangler)
npm run preview
```

Production is deployed by Cloudflare's Git-connected builds: pushing to `main` triggers a build (`npm ci && npm run build`) and deploy automatically, so there is no manual deploy step.

## Email templates

Branded, minimal HTML templates for every Supabase auth email live in `email-templates/`. Paste each into **Supabase Dashboard → Authentication → Email Templates**; the folder's `README.md` maps each file to its template slot, the `{{ .Variable }}` tokens it uses, and a suggested subject line.

| File | Supabase template |
|------|-------------------|
| `confirm-signup.html` | Confirm signup |
| `invite-user.html` | Invite user |
| `magic-link.html` | Magic Link |
| `change-email.html` | Change Email Address |
| `reset-password.html` | Reset Password |
| `reauthentication.html` | Reauthentication |
| `password-changed.html` | Password Changed |
| `email-changed.html` | Email Changed |

The account-deletion email is separate; its HTML lives inside `notify_account_deleted()` in `schema.sql` because Supabase Auth does not send it.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7 |
| Build tooling | Vite 8, Vite PWA plugin (`vite-plugin-pwa`) |
| Styling | Tailwind CSS 3, CSS custom properties (theme mode and accent colors) |
| Data fetching / caching | TanStack Query 5 |
| Backend | Supabase Auth, Supabase PostgreSQL, Supabase Row Level Security, Supabase Realtime |
| Server-side email | `pg_net` + Resend HTTP API (account-deletion email), with the key in Supabase Vault |
| Auth email delivery | Resend SMTP (via Supabase Auth) |
| Encryption | Web Crypto API (AES-GCM), Argon2id key derivation via `@noble/hashes` |
| Icons | Lucide React |
| Drawing | `perfect-freehand` for vector ink strokes |
| Syntax highlighting | `highlight.js` (automatic language detection for the Code item type) |
| File handling | JSZip |
| Asset generation | `sharp` (dev-only script that renders the app icons and social image) |
| Hosting / deploy | Cloudflare (Git-connected builds), or any static host |
| CI / tooling | GitHub Actions (lint, test, build, audit), Vitest, Dependabot, ESLint 10 |

## Project structure

```text
archespace/
  .github/
    workflows/
  docs/
  email-templates/
  scripts/
  public/
    _headers
  src/
    assets/
    components/
      editors/
      layout/
      space/
      ui/
    context/
    hooks/
    lib/
      crypto/
    pages/
    test/
    App.jsx
    index.css
    main.jsx
  schema.sql
  eslint.config.js
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
```

Key areas:

- `src/pages/` contains the public home page, login, password reset, dashboard, space view, archive, recycle bin, and settings pages.
- `src/components/` contains reusable UI, item editors, layout shell, action menus, vault unlock gate, and space components.
- `src/components/editors/` contains note, markdown, checklist, list, numbered list, and card editors, including drag-handle item reordering.
- `src/context/` contains auth, encryption, appearance/theme, toast, shortcuts, command palette, and page action providers.
- `src/hooks/` contains data hooks for spaces, items, archive, recycle bin, global search, offline sync, drag reordering, and session timeout.
- `src/lib/crypto/` contains AES-GCM encryption, Argon2id and PBKDF2 key derivation, vault setup, vault unlock, non-extractable session key storage, PIN recovery code, WebAuthn PRF passkey wrapping/unlock with a local (IndexedDB) passkey store, and encoding helpers.
- `src/lib/` contains Supabase client setup, data protection helpers, item type definitions, clipboard serialization, import/export, offline queue, rate limiting, audit logging, two-factor auth (TOTP) and backup-code helpers, password policy, build info, and shared utilities.
- `.github/` contains the CI workflow and Dependabot configuration; `docs/` contains audit and planning notes.
- `schema.sql` contains tables, indexes, RLS policies, triggers, RPC functions, realtime setup, vault recovery and PIN lockout functions, the `mfa_backup_codes` table with the backup-code redeem function and AAL2 enforcement policies for two-factor auth, the account-deletion email trigger, and the auth audit log. (Passkey unlock stores its wrapped key locally on each client, so there is no passkey table.)
- `email-templates/` contains ready-to-paste Supabase auth email templates.
- `scripts/` contains dev utilities, including `generate-icons.mjs`, which renders the PWA icons and social share image from the brand mark.
- `public/_headers` contains deployment headers for hosts such as Netlify and Cloudflare Pages.
- `vite.config.js` contains React, PWA, and manual chunk splitting configuration.

## Deployment notes

- On Cloudflare, connect the repository so pushes to `main` build and deploy automatically (Git-connected builds run `npm ci && npm run build`). For any other host, run `npm run build` and deploy the `dist/` directory.
- Configure SPA fallback to `index.html`. `dist/404.html` is generated during build for hosts that need an SPA fallback file.
- Configure Supabase redirect URLs for `/login` and `/reset-password`.
- Configure Resend SMTP in Supabase Auth before relying on password reset and other auth emails.
- Enable `pg_net` and store `RESEND_API_KEY` in Supabase Vault before relying on the account-deletion email.
- Rebuild after changing environment variables.
- Hard refresh after deploying PWA changes if a browser keeps an old service worker cache.

## Release verification

Tagged releases are built reproducibly and published to GitHub Releases with SHA-256 checksums signed by [cosign](https://github.com/sigstore/cosign) (keyless, via GitHub OIDC). This is separate from deployment - Cloudflare still deploys on push to `main`; the signed artifacts let anyone confirm what a given tag builds to.

Each release attaches:

- `checksums.txt` - SHA-256 of every file in `dist/`.
- `checksums.txt.sig` and `checksums.txt.pem` - the cosign signature and certificate.
- `archespace-<tag>-dist.tar.gz` - the built `dist/`.

**Verify the signature** (proves the checksums came from this repository's release workflow):

```bash
cosign verify-blob \
  --certificate checksums.txt.pem \
  --signature checksums.txt.sig \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/bitwyser/archespace/.github/workflows/release.yml@' \
  checksums.txt
```

**Reproduce the build** (the Node version is pinned in `.nvmrc`):

```bash
git checkout <tag>
npm ci
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) npm run build
( cd dist && find . -type f -print0 | sort -z | xargs -0 sha256sum ) | diff - checksums.txt
```

An empty diff means your build matches the signed release byte-for-byte. Builds are deterministic because the build timestamp is derived from the commit rather than the wall clock (see `resolveBuildTime` in `vite.config.js`).

The app version is derived from the git tag at build time (see `resolveVersion` in `vite.config.js`), so a release needs no manual version bump. To cut one, just tag and push:

```bash
git tag v1.2.3
git push origin v1.2.3
```

That triggers the workflow; the tag also becomes the version shown in Settings and the footer. You can also run the **Release** workflow manually from the Actions tab.

## Roadmap

A living list of directions the project is exploring. These are intentions, not commitments or dates, and they may change. Ideas and contributions are welcome, so open an issue or start a discussion (see [Contributing and development](#contributing-and-development)).

- **First-party backend (exploring).** Today ArcheSpace runs on Supabase as a backend-as-a-service, covering the database, authentication, realtime sync, and server-side secret storage in one managed platform. A planned direction is a dedicated, self-contained backend that the project owns and ships itself, rather than depending on a single external provider. The goals are fewer moving parts for anyone self-hosting (one service to run instead of wiring up a managed platform), a data layer that stays portable across databases and hosts, and full control over the auth and sync surface. This is a large change and would land incrementally, likely behind configuration so existing Supabase deployments keep working during the transition.

  The zero-knowledge design does not change: content is still encrypted in the browser and the backend still only ever stores ciphertext. What changes is where that ciphertext lives and how authentication and sync are served, not who can read your data.

- **Other improvements** are tracked as issues on the repository. If there is something you want to see, propose it there.

## Help and support

Need help setting up, self-hosting, logging in, password recovery, vault PIN recovery, or using ArcheSpace? Reach out at **[help@archespace.app](mailto:help@archespace.app)**.

Before emailing, it helps to include:

- What you were trying to do, and what happened instead.
- Your deployment type, such as single-user or multi-user.
- Your hosting provider.
- Your browser and operating system.
- Any relevant console errors or Supabase logs with secrets redacted.

For bugs and feature requests, you can also open an issue on the GitHub repository.

## Contributing and development

Contributions are welcome, including bug fixes, features, docs, and translations.

- Fork the repository, create a feature branch, and open a pull request against `main`.
- Keep PRs focused and include a short description of the change and why it is needed.
- Run `npm run lint` before submitting.
- Run `npm test` before submitting (Vitest unit tests for crypto, the markdown sanitizer, and rate limiting).
- Run `npm run build` before submitting.
- CI runs lint, tests, build, and a dependency audit on every pull request, and Dependabot proposes weekly dependency updates. The Node version is pinned in `.nvmrc`.
- For larger changes, schema changes, or security-relevant work, open an issue or reach out first so the approach can be discussed.

For development questions, architecture discussions, feature requests, bug reports, or anything related to contributing code, contact **[bitwyser@archespace.app](mailto:bitwyser@archespace.app)**.

## Credits

- Built with React, Vite, Tailwind CSS, Supabase, TanStack Query, Lucide, JSZip, and the Web Crypto API.
- Backend and authentication powered by Supabase.
- Hosted and deployed on Cloudflare.
- Source hosted on GitHub.
- Email delivery powered by Resend.
- Crafted and maintained by BitWyser.

## License

See [LICENSE](LICENSE).
