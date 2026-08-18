/**
 * passkeyStore.js - Local (IndexedDB) storage for passkey unlock records.
 *
 * The wrapped master key, credential id, and PRF salt live in the browser only -
 * never on the server. They are useless without the enrolled device's passkey
 * (the PRF secret that unwraps the key never leaves the device). Records are
 * scoped by user id so multiple accounts on one browser stay separate. Losing
 * browser storage just means falling back to the vault PIN.
 */
const DB_NAME = 'arche-passkeys'
const STORE = 'passkeys'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('userId', 'userId', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** All passkey records for a user, newest-last (creation order). */
export async function listPasskeyRecords(userId) {
  const db = await openDb()
  try {
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).index('userId').getAll(userId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  } finally {
    db.close()
  }
}

export async function savePasskeyRecord(record) {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(record)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function deletePasskeyRecord(id) {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Merge `patch` into the record with `id` (no-op if it's gone). */
export async function updatePasskeyRecord(id, patch) {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const rec = getReq.result
        if (rec) store.put({ ...rec, ...patch })
      }
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
