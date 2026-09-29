/**
 * Thumbnails do histórico de análises em IndexedDB (2026-09-29).
 *
 * Data URLs de imagem no localStorage esgotavam a quota (~5 MB) e o
 * `saveAnalysis` acabava por apagar as miniaturas de todas as entradas. O
 * IndexedDB não tem esse limite; o localStorage fica só com os metadados.
 *
 * Tudo degrada em silêncio: sem IndexedDB (ou com o store bloqueado) as
 * análises guardadas continuam a funcionar, só sem miniatura.
 */

const DB_NAME = 'histoscope_media';
const DB_VERSION = 1;
const STORE = 'thumbnails';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = op(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putThumbnail(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, 'readwrite', (store) => store.put(dataUrl, id));
  db.close();
}

export async function deleteThumbnail(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, 'readwrite', (store) => store.delete(id));
  db.close();
}

/** Devolve `{ [id]: dataUrl }` apenas para os ids encontrados. */
export async function getThumbnails(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const db = await openDb();
  if (!db) return {};
  const found: Record<string, string> = {};
  for (const id of ids) {
    const value = await run<string>(db, 'readonly', (store) => store.get(id));
    if (typeof value === 'string' && value) found[id] = value;
  }
  db.close();
  return found;
}
