/**
 * readOnly.js - Read-only spaces.
 *
 * A space's `read_only` flag is stored on the server, and the database refuses
 * edits to a read-only space's details and to its items' content, raising this
 * SQLSTATE (see schema.sql, "Read-only spaces").
 */
export const READ_ONLY_SQLSTATE = 'P0R01'

/** True when a write failed because its space is read-only. */
export function isReadOnlyError(err) {
  return err?.code === READ_ONLY_SQLSTATE
}

export const READ_ONLY_MESSAGE = 'This space is read-only.'
