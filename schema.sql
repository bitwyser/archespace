-- ============================================================
-- ArcheSpace - Database Schema (Supabase / PostgreSQL)
-- ============================================================
--
-- This is the complete schema for the ArcheSpace app.
-- Run it once in the Supabase SQL Editor on a
-- new project to create every table (with all columns already in
-- place), index, function, trigger, RLS policy, and realtime
-- publication in one pass.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / IF EXISTS
-- guards so nothing breaks if the objects already exist.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- Spaces: top-level containers owned by a single user.
CREATE TABLE IF NOT EXISTS spaces (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  position    integer     NOT NULL DEFAULT 0,
  pinned      boolean     NOT NULL DEFAULT false,
  color       text        DEFAULT NULL,
  theme       text        DEFAULT NULL,
  tags        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  deleted_at  timestamptz DEFAULT NULL,          -- soft-delete; NULL = active
  archived_at timestamptz DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Space Items: individual content blocks inside a space.
CREATE TABLE IF NOT EXISTS space_items (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id    uuid        REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        text        NOT NULL CHECK (type IN ('textbox', 'checkbox_list', 'menu_list', 'numbered_list', 'card_list', 'markdown', 'code', 'secret', 'draw', 'table')),
  title       text        NOT NULL DEFAULT '',
  content     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  position    integer     NOT NULL DEFAULT 0,
  pinned      boolean     NOT NULL DEFAULT false,
  deleted_at  timestamptz DEFAULT NULL,
  archived_at timestamptz DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Keep the allowed item types in sync on existing databases (CREATE TABLE above
-- only applies to fresh installs). Re-running this file updates the constraint.
ALTER TABLE space_items DROP CONSTRAINT IF EXISTS space_items_type_check;
ALTER TABLE space_items ADD CONSTRAINT space_items_type_check
  CHECK (type IN ('textbox', 'checkbox_list', 'menu_list', 'numbered_list', 'card_list', 'markdown', 'code', 'secret', 'draw', 'table'));

-- Audit log: auth events only, owner-only access (see section 4).
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text        NOT NULL,
  details    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User Encryption: per-user metadata for client-side encrypted vaults.
-- Stores PBKDF2 salt + encrypted verifier, never the raw key.
CREATE TABLE IF NOT EXISTS user_encryption (
  user_id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt                 text        NOT NULL,
  key_check            text        NOT NULL,
  wrapped_key          text        DEFAULT NULL,
  recovery_salt        text        DEFAULT NULL,
  recovery_wrapped_key text        DEFAULT NULL,
  vault_format         text        DEFAULT 'legacy',
  pin_failed_attempts  integer     NOT NULL DEFAULT 0,
  pin_locked_until     timestamptz DEFAULT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Passkeys (WebAuthn PRF) that wrap the vault master key for biometric unlock.
-- The PRF secret never leaves the device; only the wrapped master key, the
-- credential id, and the PRF salt are stored here (useless without the device).
CREATE TABLE IF NOT EXISTS user_passkeys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text        NOT NULL,
  prf_salt      text        NOT NULL,
  wrapped_key   text        NOT NULL,
  label         text        DEFAULT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz DEFAULT NULL,
  UNIQUE (user_id, credential_id)
);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON user_passkeys(user_id);

-- User Settings: per-user application preferences.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_mode   text        NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('system', 'dark', 'light')),
  accent_color text        NOT NULL DEFAULT 'mint'   CHECK (accent_color IN ('mint', 'lavender', 'amber')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────

-- Spaces
CREATE INDEX IF NOT EXISTS spaces_user_id_idx     ON spaces(user_id);
CREATE INDEX IF NOT EXISTS spaces_position_idx    ON spaces(user_id, position);
CREATE INDEX IF NOT EXISTS spaces_pinned_idx      ON spaces(pinned)      WHERE pinned = true;
CREATE INDEX IF NOT EXISTS spaces_deleted_at_idx  ON spaces(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS spaces_archived_at_idx ON spaces(archived_at) WHERE archived_at IS NOT NULL;

-- Space items
CREATE INDEX IF NOT EXISTS items_space_id_idx     ON space_items(space_id);
CREATE INDEX IF NOT EXISTS items_user_id_idx      ON space_items(user_id);
CREATE INDEX IF NOT EXISTS items_position_idx     ON space_items(space_id, position);
CREATE INDEX IF NOT EXISTS space_items_pinned_idx ON space_items(pinned)      WHERE pinned = true;
CREATE INDEX IF NOT EXISTS items_deleted_at_idx   ON space_items(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS items_archived_at_idx  ON space_items(archived_at) WHERE archived_at IS NOT NULL;

-- Audit log
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx       ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx    ON audit_log(created_at);


-- ────────────────────────────────────────────────────────────
-- 3. TRIGGERS & FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Auto-update updated_at on every row change.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spaces_updated_at ON spaces;
CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_space_items_updated_at ON space_items;
CREATE TRIGGER trg_space_items_updated_at
  BEFORE UPDATE ON space_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-populate user_id on space_items from the parent space.
CREATE OR REPLACE FUNCTION populate_item_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM spaces WHERE id = NEW.space_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_populate_item_user_id ON space_items;
CREATE TRIGGER trg_populate_item_user_id
  BEFORE INSERT ON space_items
  FOR EACH ROW EXECUTE FUNCTION populate_item_user_id();

-- Purge soft-deleted rows older than 30 days. Wire to pg_cron / scheduled edge function.
CREATE OR REPLACE FUNCTION purge_old_deleted_records()
RETURNS void AS $$
BEGIN
  DELETE FROM space_items WHERE deleted_at < now() - interval '30 days';
  DELETE FROM spaces      WHERE deleted_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE spaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encryption ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passkeys    ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_encryption TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_settings   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_passkeys   TO authenticated;

-- Spaces: full CRUD for the owning user only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spaces' AND policyname = 'Users can manage their own spaces') THEN
    CREATE POLICY "Users can manage their own spaces"
      ON spaces FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Space items: full CRUD for the owning user only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'space_items' AND policyname = 'Users can manage their own items') THEN
    CREATE POLICY "Users can manage their own items"
      ON space_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User encryption metadata: full CRUD for the owning user only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_encryption' AND policyname = 'Users manage own encryption metadata') THEN
    CREATE POLICY "Users manage own encryption metadata"
      ON user_encryption FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- User settings: full CRUD for the owning user only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users manage own settings') THEN
    CREATE POLICY "Users manage own settings"
      ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User passkeys: full CRUD for the owning user only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_passkeys' AND policyname = 'Users manage own passkeys') THEN
    CREATE POLICY "Users manage own passkeys"
      ON user_passkeys FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- audit_log: no policies + grants revoked = owner / service_role only.
REVOKE ALL ON TABLE audit_log FROM anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. REALTIME
-- ────────────────────────────────────────────────────────────

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE space_items;


-- ────────────────────────────────────────────────────────────
-- 6. RPC FUNCTIONS FOR BULK UPDATES
-- ────────────────────────────────────────────────────────────

-- Bulk-update space positions (ownership enforced via auth.uid()).
CREATE OR REPLACE FUNCTION update_space_positions(updates jsonb)
RETURNS void AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM jsonb_to_recordset(updates) AS x(id uuid, position integer) LOOP
    UPDATE spaces SET position = r.position WHERE id = r.id AND user_id = auth.uid();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bulk-update item positions (ownership enforced via auth.uid()).
CREATE OR REPLACE FUNCTION update_item_positions(updates jsonb)
RETURNS void AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM jsonb_to_recordset(updates) AS x(id uuid, position integer) LOOP
    UPDATE space_items SET position = r.position WHERE id = r.id AND user_id = auth.uid();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────
-- 7. VAULT PIN BRUTE-FORCE PROTECTION
-- ────────────────────────────────────────────────────────────
-- (pin_failed_attempts / pin_locked_until columns are defined
--  on user_encryption in section 1 above)

CREATE OR REPLACE FUNCTION get_vault_pin_lock_status()
RETURNS jsonb AS $$
DECLARE
  v_locked_until timestamptz;
  v_retry_after  integer;
BEGIN
  SELECT pin_locked_until INTO v_locked_until FROM user_encryption WHERE user_id = auth.uid();
  IF NOT FOUND OR v_locked_until IS NULL OR v_locked_until <= now() THEN
    RETURN jsonb_build_object('locked', false, 'retry_after_seconds', 0);
  END IF;
  v_retry_after := GREATEST(0, EXTRACT(EPOCH FROM (v_locked_until - now()))::integer);
  RETURN jsonb_build_object('locked', true, 'retry_after_seconds', v_retry_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION record_vault_pin_unlock_failure()
RETURNS void AS $$
DECLARE
  v_max_attempts constant integer := 5;
  v_lock_minutes constant integer := 5;
  v_attempts     integer;
  v_locked_until timestamptz;
BEGIN
  SELECT pin_failed_attempts, pin_locked_until
    INTO v_attempts, v_locked_until
  FROM user_encryption WHERE user_id = auth.uid();

  IF NOT FOUND THEN RETURN; END IF;

  -- A previous lock has fully expired: start a fresh count so the user
  -- gets another full set of attempts rather than re-locking on every try.
  IF v_locked_until IS NOT NULL AND v_locked_until <= now() THEN
    v_attempts := 0;
  END IF;

  v_attempts := v_attempts + 1;

  UPDATE user_encryption
  SET pin_failed_attempts = v_attempts,
      pin_locked_until = CASE
        WHEN v_attempts >= v_max_attempts THEN now() + (v_lock_minutes || ' minutes')::interval
        ELSE NULL
      END
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION record_vault_pin_unlock_success()
RETURNS void AS $$
BEGIN
  UPDATE user_encryption SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL   ON FUNCTION get_vault_pin_lock_status()          FROM PUBLIC;
REVOKE ALL   ON FUNCTION record_vault_pin_unlock_failure()    FROM PUBLIC;
REVOKE ALL   ON FUNCTION record_vault_pin_unlock_success()    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_vault_pin_lock_status()         TO authenticated;
GRANT EXECUTE ON FUNCTION record_vault_pin_unlock_failure()   TO authenticated;
GRANT EXECUTE ON FUNCTION record_vault_pin_unlock_success()   TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 8. ACCOUNT DELETION
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL   ON FUNCTION delete_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_current_user() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 9. ACCOUNT-DELETION EMAIL (Resend)
-- ────────────────────────────────────────────────────────────
-- RESEND_API_KEY stays ENCRYPTED in Supabase Vault; sent server-side inside a Postgres trigger via pg_net (async HTTP), never exposed to the client.
-- One-time setup:
-- 1) enable pg_net (statement or Dashboard -> Extensions)
-- 2) add the secret via Dashboard → Vault or run this once in the SQL editor: vault.create_secret('re_your_key','RESEND_API_KEY')
-- 3) verify sending domain in Resend

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_account_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_api_key text;
  v_from    text := 'ArcheSpace <auth@archespace.cc>';  -- verified Resend domain
  v_subject text := 'Your ArcheSpace account has been deleted';
  v_support text := 'help@archespace.cc';                 -- reply-to / support
  v_html    text;
  v_text    text;
BEGIN
  -- User row is already gone; keep identity in details.
  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (NULL, 'account_deleted',
          jsonb_build_object('user_id', OLD.id, 'email', OLD.email, 'deleted_at', now()));

  -- Nothing to send to if the row had no email.
  IF OLD.email IS NULL THEN
    RETURN OLD;
  END IF;

  -- Read the key straight from Vault (decrypted only for the
  -- SECURITY DEFINER owner; never exposed to clients).
  SELECT decrypted_secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY';
  IF v_api_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY missing from Vault; deletion email skipped';
    RETURN OLD;
  END IF;

  v_html :=
    $html$<div style="margin:0;padding:0;width:100%;background-color:#0f1115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="padding:64px 40px;">
    <div style="font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7fe3c0;">ArcheSpace</div>
    <h1 style="margin:28px 0 18px;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;">Sorry to see you go 👋</h1>
    <p style="margin:0 0 18px;max-width:560px;font-size:16px;line-height:1.65;color:#c4cad6;">Your ArcheSpace account <strong style="color:#ffffff;">$html$ || OLD.email || $html$</strong> has been permanently deleted, along with all of your spaces, items, and encrypted vault data. This is just a confirmation, so there's nothing left for you to do.</p>
    <p style="margin:0 0 40px;max-width:560px;font-size:16px;line-height:1.65;color:#c4cad6;">Thank you for giving ArcheSpace a try. If you ever change your mind, you're always welcome back. 💚</p>
    <div style="height:1px;width:100%;max-width:560px;background-color:#262b36;margin:0 0 24px;"></div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#8b93a3;">Need help, or didn't request this? Contact us at <a href="mailto:$html$ || v_support || $html$" style="color:#7fe3c0;text-decoration:none;">$html$ || v_support || $html$</a>.</p>
  </div>
</div>$html$;

  -- Plaintext fallback (improves deliverability and covers clients
  -- that don't render HTML).
  v_text :=
    'Sorry to see you go 👋' || E'\n\n'
    || 'Your ArcheSpace account ' || OLD.email || ' has been permanently deleted, '
    || 'along with all of your spaces, items, and encrypted vault data. '
    || 'This is just a confirmation, so there is nothing left for you to do.' || E'\n\n'
    || 'Thank you for giving ArcheSpace a try. If you ever change your mind, you are '
    || 'always welcome back. 💚' || E'\n\n'
    || 'Need help, or did not request this? Contact us at ' || v_support || '.';

  -- Fire-and-forget async POST to Resend.
  PERFORM net.http_post(
    url     => 'https://api.resend.com/emails',
    headers => jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
    body    => jsonb_build_object('from', v_from, 'to', OLD.email, 'reply_to', v_support,
                                  'subject', v_subject, 'html', v_html, 'text', v_text)
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_account_deleted ON auth.users;
CREATE TRIGGER trg_notify_account_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_account_deleted();


-- ────────────────────────────────────────────────────────────
-- 10. AUTH AUDIT LOGGING (auth events only, owner-only table)

-- ────────────────────────────────────────────────────────────
-- Server-side: account_created, email_change, password_reset_requested
--   (account_deleted is written in section 9). Client-side via
--   log_client_event: login, logout, password_change, password_reset,
--   vault_setup, vault_unlock, vault_lock, vault_pin_change,
--   vault_pin_reset, recovery_code_created, export, import.

CREATE OR REPLACE FUNCTION public.log_auth_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, details)
    VALUES (NEW.id, 'account_created', jsonb_build_object('email', NEW.email));
    RETURN NEW;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    INSERT INTO audit_log (user_id, action, details)
    VALUES (NEW.id, 'email_change', jsonb_build_object('from', OLD.email, 'to', NEW.email));
  ELSIF NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at AND NEW.recovery_sent_at IS NOT NULL THEN
    INSERT INTO audit_log (user_id, action)
    VALUES (NEW.id, 'password_reset_requested');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_auth_event ON auth.users;
CREATE TRIGGER trg_log_auth_event
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_auth_event();

-- Whitelisted client-side audit writes, for the current user only.
CREATE OR REPLACE FUNCTION public.log_client_event(
  p_action  text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_action NOT IN (
    'login', 'logout',
    'password_change', 'password_reset',
    'vault_setup', 'vault_unlock', 'vault_lock',
    'vault_pin_change', 'vault_pin_reset', 'recovery_code_created',
    'export', 'import'
  ) THEN
    RAISE EXCEPTION 'Unsupported audit action: %', p_action;
  END IF;

  INSERT INTO audit_log (user_id, action, details)
  VALUES (auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
END;
$$;

REVOKE ALL   ON FUNCTION public.log_client_event(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_event(text, jsonb) TO authenticated;
