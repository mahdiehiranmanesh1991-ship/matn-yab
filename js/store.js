// On-device history in IndexedDB (nothing ever leaves the phone).
const DB = 'matn-yab', STORE = 'docs';
let dbp;
const open = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('date', 'date'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const s = t.objectStore(STORE);
  const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = () => rej(t.error); }); };
export const saveDoc = (doc) => tx('readwrite', (s) => s.put(doc));
export const getDoc = (id) => tx('readonly', (s) => s.get(id));
export const deleteDoc = (id) => tx('readwrite', (s) => s.delete(id));
export const clearDocs = () => tx('readwrite', (s) => s.clear());
export const listDocs = async () => (await tx('readonly', (s) => s.getAll())).sort((a, b) => b.date - a.date);
