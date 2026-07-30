# Arche Space crypto format (`arc1`)

This is the language-neutral contract every Arche Space client must implement
identically. The web app is the reference implementation; any other client
(the Flutter mobile app, a future backend) must produce and consume the exact
same bytes, or data encrypted on one client will not decrypt on another.

Conformance is checked against `spec/vectors.json`, generated from the real web
crypto code by `scripts/gen-crypto-vectors.mjs`. A client is correct if and only
if it passes every vector.

## 1. Encoding

- **Base64**: standard alphabet (`A-Z a-z 0-9 + /`) **with** `=` padding. Not
  URL-safe. (Web uses `btoa`/`atob`.)
- **Text**: UTF-8 for all plaintext and secrets.

## 2. Symmetric cipher: `arc1`

Every encrypted value is a string:

```
arc1:<base64(iv)>.<base64(ciphertext)>
```

- Prefix is the literal `arc1:`.
- `iv` is **12 random bytes** (96-bit), generated fresh per encryption.
- Cipher is **AES-256-GCM**. `ciphertext` is the GCM output **with the 16-byte
  (128-bit) auth tag appended** (this is what WebCrypto returns; many libraries
  append the tag by default, but confirm).
- No additional authenticated data (AAD).
- The two base64 chunks are separated by a single `.` (split on the **first**
  dot; base64 itself never contains a dot).
- A value that does not start with `arc1:` is treated as plaintext (legacy /
  not-yet-encrypted), never decrypted.
- Encrypting `null`/empty yields an empty string `""` (not an `arc1:` value).

JSON values are encrypted as `arc1(JSON.stringify(value))` and decrypted by
parsing the recovered UTF-8 string as JSON.

## 3. Key derivation (vault secret -> 32-byte AES key)

The stored `salt` (and `recovery_salt`) is **self-describing**, so the client
picks the KDF from its shape.

### Argon2id (all new vaults)

Descriptor string:

```
argon2id$<m>$<t>$<p>$<base64(salt)>
```

- Current params: `m = 19456` (KiB, = 19 MiB), `t = 2`, `p = 1`.
- Salt is 16 bytes; output length `dkLen = 32`.
- Input is the UTF-8 bytes of the secret (PIN, passphrase, or normalized
  recovery code). The 32-byte output is imported directly as the AES-256-GCM key.
- Params are read **from the descriptor**, not hardcoded, so older vaults with
  different params keep working.

### PBKDF2 (legacy vaults only)

If the descriptor is a **plain base64 string** (no `argon2id$` prefix), it is a
legacy PBKDF2 salt:

- PBKDF2 with **HMAC-SHA-256**, **310000** iterations, 256-bit output.
- Salt is the base64-decoded bytes. Output is the AES-256-GCM key.

Legacy vaults are upgraded to Argon2id the next time the PIN/passphrase changes;
a client must still be able to unlock them.

## 4. Vault wrapping (how the master key is protected)

Each user has one random **master key** (256-bit AES-GCM). All space/item content
is encrypted with the master key. The master key itself is wrapped by keys
derived from the PIN and (optionally) a recovery code. The `user_encryption` row
holds:

| Column | Meaning |
|--------|---------|
| `salt` | PIN KDF descriptor (section 3) |
| `wrapped_key` | `arc1( base64(rawMasterKeyBytes) )` encrypted with the **PIN-derived** key |
| `key_check` | `arc1( "ARCHE_VAULT_V1_OK" )` encrypted with the **master** key |
| `recovery_salt` | recovery-code KDF descriptor (optional) |
| `recovery_wrapped_key` | `arc1( base64(rawMasterKeyBytes) )` encrypted with the **recovery-derived** key (optional) |
| `vault_format` | `pin_wrapped` |

### Unlock flow (PIN)

1. `pinKey = KDF(pin, salt)` (section 3).
2. `rawB64 = decrypt(wrapped_key, pinKey)` — a wrong PIN makes GCM auth fail;
   treat any failure here as "incorrect PIN".
3. `masterKey = importAes(base64Decode(rawB64))`.
4. `check = decrypt(key_check, masterKey)`; require `check == "ARCHE_VAULT_V1_OK"`.
5. On success, `masterKey` decrypts all content.

The recovery flow is identical with `recovery_salt` / `recovery_wrapped_key` and
the normalized recovery code as the secret.

## 5. What is encrypted vs. plaintext

Encrypted (per-user, with the master key): space `name`, `description`, `tags`;
item `title` and `content`. Plaintext metadata (never encrypted): ids,
timestamps, `position`, `type`, and flags (`pinned`, `archived_at`,
`deleted_at`). See `schema.sql` for columns.

## 6. Conformance

Run `node scripts/gen-crypto-vectors.mjs` in the web repo to (re)generate
`spec/vectors.json`. Each entry is one of:

- `kdf` — `{ algo, secret, descriptor, expectedKeyB64 }`: derive and match.
- `decrypt` — `{ keyB64, arc1, expectedPlaintext }`: decrypt and match.
- `vaultUnlock` — a full row (`pin`, `salt`, `wrapped_key`, `key_check`,
  sample content): run the section-4 unlock and decrypt the samples.

A client ports section 2-4, loads `vectors.json`, and asserts every entry. When
the crypto changes on web, regenerate and re-vendor the file to each client.
