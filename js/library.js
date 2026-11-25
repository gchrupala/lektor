// The documents on this device, in IndexedDB: the PDF itself (so it can be
// parsed again when the parser improves) and what was made of it, with the
// place where listening stopped.
//
// Store "docs": { id, name, title, author, lang, pages, size, addedAt, model (layout.buildDocument) }
// Store "files": { id, blob }
// Store "state": { id, pos: { b, i }, openedAt } — small, written often

const DB_NAME = 'lektor';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const result = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(result?.result ?? result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('aborted'));
      }),
  );
}

/** Documents without their model, with where listening stopped, last opened first. */
export async function listDocs() {
  const all = await run('docs', 'readonly', (s) => s.getAll());
  const states = new Map((await run('state', 'readonly', (s) => s.getAll())).map((x) => [x.id, x]));
  return all
    .map(({ model, ...meta }) => {
      const st = states.get(meta.id);
      const blocks = model?.blocks?.length || 1;
      return { ...meta, openedAt: st?.openedAt || meta.addedAt, progress: st?.pos ? st.pos.b / blocks : 0, page: st?.pos ? model.blocks[st.pos.b]?.p : null };
    })
    .sort((a, b) => b.openedAt - a.openedAt);
}

export const getDoc = (id) => run('docs', 'readonly', (s) => s.get(id));
export const putDoc = (doc) => run('docs', 'readwrite', (s) => s.put(doc));
export const getFile = (id) => run('files', 'readonly', (s) => s.get(id)).then((r) => r?.blob ?? null);
export const putFile = (id, blob) => run('files', 'readwrite', (s) => s.put({ id, blob }));

export const getState = (id) => run('state', 'readonly', (s) => s.get(id));

export async function removeDoc(id) {
  for (const store of ['docs', 'files', 'state']) await run(store, 'readwrite', (s) => s.delete(id));
}

/** Saves where listening stopped. */
export function savePosition(id, pos) {
  return run('state', 'readwrite', (s) => s.put({ id, pos, openedAt: Date.now() }));
}

/** A document's id: the start of the SHA-256 of its bytes, so the same PDF is one entry. */
export async function fileId(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Asks the browser not to evict the library when space runs low. */
export function persist() {
  return navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false);
}
