// Photos taken while offline, kept in IndexedDB until they can get a full analysis.

const DB = "cropcare";
const STORE = "pendingScans";
const EVENT = "cropcare:queue-changed";

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = () => reject(tx.error);
  });
}

const changed = () => window.dispatchEvent(new Event(EVENT));

// files: File[]; result: the offline diagnosis (may be null when no offline model)
export async function addPendingScan({ files, location, result }) {
  const id = await run("readwrite", (store) =>
    store.add({
      createdAt: new Date().toISOString(),
      // Keep name and type: the backend checks the content, the UI shows the name
      files: files.map((file) => ({ blob: file, name: file.name, type: file.type })),
      lat: location?.lat ?? null,
      lon: location?.lon ?? null,
      result: result || null,
    })
  );
  changed();
  return id;
}

export const listPendingScans = () => run("readonly", (store) => store.getAll());

export async function removePendingScan(id) {
  await run("readwrite", (store) => store.delete(id));
  changed();
}

export const toFiles = (scan) => scan.files.map((f) => new File([f.blob], f.name, { type: f.type }));

export const onQueueChange = (callback) => {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
};
