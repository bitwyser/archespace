# Security Policy

Security is central to ArcheSpace. Your content is end-to-end encrypted on your
device and our servers only ever store ciphertext, so we cannot read it. We
still want to hear about any weakness in the app, the service, or the
cryptography - responsible disclosure helps keep everyone safe.

## Reporting a vulnerability

Please report security issues **privately** to:

**security@archespace.app**

Do **not** open a public GitHub issue, pull request, or discussion for a
security vulnerability, and please don't disclose it publicly until we've had a
chance to fix it and agree on timing with you.

If you'd like to encrypt your report, email us first and request our PGP key.

### What to include

To help us triage quickly, please include as much as you can:

- A clear description of the issue and its potential impact.
- Step-by-step instructions to reproduce it (proof-of-concept if possible).
- The affected component and version (web `archespace.app`, the mobile app, or
  a specific release / commit).
- Any relevant logs, screenshots, or request/response details.
- How you'd like to be credited, if you want acknowledgement.

## Our commitment

When you report in good faith under this policy, we will:

- **Acknowledge** your report within **3 business days**.
- Give you a **status update within 7 days**, and keep you informed as we work
  on a fix.
- Work with you on **coordinated disclosure** and credit you (if you wish) once
  the issue is resolved.
- **Not pursue legal action** against you for good-faith research that follows
  this policy (see Safe harbor below).

## Scope

**In scope:**

- The web app at `archespace.app` and the ArcheSpace web source repository.
- The ArcheSpace mobile app and its source repository.
- The cryptography, authentication, vault, and data-handling logic.

**Out of scope:**

- Vulnerabilities in third-party services we use (report those to the provider):
  Supabase, Cloudflare, Resend.
- Denial-of-service, volumetric, or brute-force attacks.
- Social engineering, phishing, or physical attacks against us, our users, or
  our staff.
- Spam, missing security headers, or best-practice suggestions with no
  demonstrable security impact.
- Reports from automated scanners without a working proof-of-concept.

## Guidelines for researchers

Please help us keep users safe while you test:

- Only use **your own test accounts and data**. Do not access, modify, or
  delete data that isn't yours.
- **Do not exfiltrate data.** If you can access another user's data, stop, and
  report the minimum needed to demonstrate the issue.
- Avoid privacy violations, service degradation, and destructive testing.
- Give us a reasonable time to remediate before any public disclosure.

## Safe harbor

We consider security research and disclosure conducted in accordance with this
policy to be authorized, and we will not initiate legal action for accidental,
good-faith violations. If in doubt, ask us at security@archespace.app before
proceeding.

## Supported versions

ArcheSpace is a continuously deployed service; the version running at
`archespace.app` is always the supported one. If you self-host from the source,
please run the latest release before reporting an issue.

---

Thank you for helping keep ArcheSpace and its users safe.
