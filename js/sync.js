/* ============================================================
   Sync — sincronización con servidor WebDAV (Nextcloud, Synology, etc.)
   - Sube/descarga la DB cifrada directamente (no necesita descifrar)
   - Conflictos: last-write-wins con timestamp
   - Config: URL, usuario, contraseña (se guarda en settings)
   ============================================================ */
window.SyncModule = (function () {
  const SETTINGS_KEYS = { url: "webdav_url", username: "webdav_user", password: "webdav_pass" };
  const REMOTE_PATH = "/saludinfantil/db.enc"; // path relativo al URL base

  function getConfig() {
    return {
      url: (Storage.getSettings()[SETTINGS_KEYS.url] || "").replace(/\/+$/, ""),
      username: Storage.getSettings()[SETTINGS_KEYS.username] || "",
      password: Storage.getSettings()[SETTINGS_KEYS.password] || "",
    };
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.url && c.username && c.password);
  }

  function basicAuthHeader(username, password) {
    return "Basic " + btoa(username + ":" + password);
  }

  /**
   * Sube la DB cifrada actual al servidor WebDAV.
   * Devuelve { ok, timestamp, message }.
   */
  async function push() {
    const c = getConfig();
    if (!isConfigured()) throw new Error("Sync no configurado");
    // Flush pending writes
    await Storage.persistNow();
    // Leer el blob cifrado directamente de IDB
    const idb = await new Promise((resolve, reject) => {
      const req = indexedDB.open("saludinfantil_idb", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const blob = await new Promise((resolve, reject) => {
      const tx = idb.transaction("sqlite_blobs", "readonly");
      const req = tx.objectStore("sqlite_blobs").get("main_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!blob) throw new Error("No hay datos locales para subir");
    const fullUrl = c.url + REMOTE_PATH;
    const resp = await fetch(fullUrl, {
      method: "PUT",
      headers: {
        "Authorization": basicAuthHeader(c.username, c.password),
        "Content-Type": "application/octet-stream",
        "X-SaludInfantil-Timestamp": new Date().toISOString(),
      },
      body: blob,
    });
    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      throw new Error(`WebDAV PUT falló: ${resp.status} ${resp.statusText}`);
    }
    Storage.setSettings({ lastSyncPush: new Date().toISOString() });
    return { ok: true, timestamp: new Date().toISOString(), action: "push" };
  }

  /**
   * Descarga la DB cifrada del servidor y reemplaza la local.
   * CUIDADO: pisa los datos locales. Requiere confirmación previa.
   */
  async function pull() {
    const c = getConfig();
    if (!isConfigured()) throw new Error("Sync no configurado");
    const fullUrl = c.url + REMOTE_PATH;
    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Authorization": basicAuthHeader(c.username, c.password),
      },
    });
    if (resp.status === 404) throw new Error("No hay datos en el servidor");
    if (!resp.ok) throw new Error(`WebDAV GET falló: ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();
    // Guardar en IDB directamente
    const idb = await new Promise((resolve, reject) => {
      const req = indexedDB.open("saludinfantil_idb", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = idb.transaction("sqlite_blobs", "readwrite");
      tx.objectStore("sqlite_blobs").put(blob, "main_db");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    Storage.setSettings({ lastSyncPull: new Date().toISOString() });
    return { ok: true, timestamp: new Date().toISOString(), size: blob.size, action: "pull" };
  }

  /**
   * Sincroniza: si local es más nuevo que remoto, push; si remoto es más nuevo, pull.
   * Para evitar complejidad, la primera vez sube local, las siguientes compara timestamps.
   */
  async function sync() {
    if (!isConfigured()) throw new Error("Sync no configurado");
    const c = getConfig();
    const resp = await fetch(c.url + REMOTE_PATH, {
      method: "HEAD",
      headers: { "Authorization": basicAuthHeader(c.username, c.password) },
    });
    if (resp.status === 404) {
      // No hay datos remotos → subir lo local
      const r = await push();
      return { ...r, action: "push" };
    }
    if (!resp.ok) throw new Error(`WebDAV HEAD falló: ${resp.status}`);
    const remoteTs = resp.headers.get("X-SaludInfantil-Timestamp")
      || resp.headers.get("Last-Modified")
      || new Date(0).toISOString();
    const settings = Storage.getSettings();
    const localTs = settings.lastSyncPush || settings.lastBackup || new Date(0).toISOString();
    if (new Date(remoteTs) > new Date(localTs)) {
      const r = await pull();
      return { ...r, action: "pull" };
    } else {
      const r = await push();
      return { ...r, action: "push" };
    }
  }

  async function testConnection() {
    const c = getConfig();
    if (!isConfigured()) throw new Error("Sync no configurado. Completá URL, usuario y contraseña.");
    // PROPFIND para WebDAV, o un GET simple
    const resp = await fetch(c.url + "/", {
      method: "PROPFIND",
      headers: {
        "Authorization": basicAuthHeader(c.username, c.password),
        "Depth": "0",
      },
    });
    // 207 Multi-Status es la respuesta correcta de WebDAV. 200/204 también OK.
    if (resp.ok || resp.status === 207 || resp.status === 301 || resp.status === 302) {
      return { ok: true, status: resp.status };
    }
    if (resp.status === 401) throw new Error("Usuario o contraseña incorrectos");
    if (resp.status === 403) throw new Error("Acceso denegado. Verificá permisos en la carpeta");
    if (resp.status === 404) throw new Error("URL no encontrada. Verificá la dirección del servidor");
    throw new Error(`Error del servidor: ${resp.status} ${resp.statusText}`);
  }

  return { isConfigured, getConfig, push, pull, sync, testConnection, SETTINGS_KEYS };
})();