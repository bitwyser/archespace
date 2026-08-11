# ArcheSpace email templates

Paste the HTML into **Supabase Dashboard → Authentication → Email Templates**.

## Native Supabase templates

| File | Supabase template | Variables used | Suggested subject |
|------|-------------------|----------------|-------------------|
| `confirm-signup.html` | Confirm signup | `{{ .ConfirmationURL }}` | Confirm your ArcheSpace email |
| `invite-user.html` | Invite user | `{{ .ConfirmationURL }}` | You're invited to ArcheSpace |
| `magic-link.html` | Magic Link | `{{ .ConfirmationURL }}`, `{{ .Token }}` | Your ArcheSpace sign in link |
| `change-email.html` | Change Email Address | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}` | Confirm your new ArcheSpace email |
| `reset-password.html` | Reset Password | `{{ .ConfirmationURL }}` | Reset your ArcheSpace password |
| `reauthentication.html` | Reauthentication | `{{ .Token }}` | Confirm it's you |
| `password-changed.html` | Password Changed | - | Your ArcheSpace password was changed |
| `email-changed.html` | Email Changed | `{{ .NewEmail }}` | Your ArcheSpace email was changed |

The last two are notification-only (no action link); Supabase sends them
automatically after the corresponding change.
