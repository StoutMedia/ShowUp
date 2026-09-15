let db;
export function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("showup-v1", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("state");
      r.result.createObjectStore("videos", { keyPath: "id" });
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      db = r.result;
      resolve(db);
    };
  });
}
export function get(store, key) {
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export function all(store) {
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export function put(store, value, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    const o = tx.objectStore(store);
    key === undefined ? o.put(value) : o.put(value, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
export function remove(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
