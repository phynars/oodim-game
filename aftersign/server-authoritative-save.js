const DB_NAME = "aftersign-authoritative-save";
const STORE_NAME = "save_slots";
const DB_VERSION = 1;

function makeKey({ slot, playerId }) {
  return `${playerId}::${slot}`;
}

function openDb() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open authoritative save db"));
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    tx.oncomplete = () => finish(null);
    tx.onabort = () => reject(tx.error ?? new Error("Authoritative save transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Authoritative save transaction failed"));

    run({ store, finish, reject });
  });
}

export async function writeAuthoritativeSave({ slot, playerId, payload }) {
  const key = makeKey({ slot, playerId });
  await withStore("readwrite", ({ store }) => {
    store.put({
      key,
      slot,
      playerId,
      payload,
      revision: payload?.save?.revision ?? null,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function readAuthoritativeSave({ slot, playerId }) {
  const key = makeKey({ slot, playerId });
  const row = await withStore("readonly", ({ store, finish, reject }) => {
    const request = store.get(key);
    request.onsuccess = () => finish(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read authoritative save"));
  });

  return row?.payload ?? null;
}

export async function clearAuthoritativeSave({ slot, playerId }) {
  const key = makeKey({ slot, playerId });
  await withStore("readwrite", ({ store }) => {
    store.delete(key);
  });
}
