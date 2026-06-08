/**
 * IndexedDB — imagens da fila de patrimônio (lotes até 200+ PDFs).
 * Evita estourar localStorage (~5 MB) e sobrevive a recarregar a página.
 */
(function portalPatrimonioIdb() {
  const DB_NAME = "dk_patrimonio_fila_v1";
  const STORE = "assets";
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB indisponível"));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB falhou"));
    });
    return dbPromise;
  }

  function txStore(mode) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          tx.oncomplete = () => resolve(store);
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  async function idbPut(id, data) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id, ...data, atualizadoEm: new Date().toISOString() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbHas(id) {
    const row = await idbGet(id);
    return Boolean(row?.imagem);
  }

  async function idbGetAllIds() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  window.__DK_patrimonioIdbPut = idbPut;
  window.__DK_patrimonioIdbGet = idbGet;
  window.__DK_patrimonioIdbDelete = idbDelete;
  window.__DK_patrimonioIdbHas = idbHas;
  window.__DK_patrimonioIdbGetAllIds = idbGetAllIds;
})();
