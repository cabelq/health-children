/* ============================================================
   cloud-sync.js — sincronización con el backend de SaludInfantil
   - Usa ApiClient (JWT + REST)
   - ETag para evitar pisadas entre devices
   - Estrategia: last-write-wins por defecto, conflict resolution opcional
   - Se ejecuta manual o auto (después de cada persist si hay backend)
   ============================================================ */
window.CloudSync = (function () {

  /**
   * Lee el blob cifrado actual desde IndexedDB.
   */
  async function getLocalBlob() {
    if (typeof Storage === "undefined") return null;
    await Storage.init?.();
    // Exponer helper: Storage.getIdbRawBlob
    if (typeof Storage.getIdbRawBlob === "function") {
      return await Storage.getIdbRawBlob();
    }
    // Fallback: usar API interna de storage
    try {
      return await Storage._getRawIdbBlob?.();
    } catch {
      return null;
    }
  }

  /** HEAD remoto */
  async function getRemoteMeta() {
    if (!ApiClient.isConfigured()) throw new Error("Backend no configurado");
    if (!ApiClient.isAuthenticated()) throw new Error("No autenticado en el backend");
    return await ApiClient.headDatabase();
  }

  /**
   * Sube el blob cifrado al server.
   * Si ifMatch se pasa, hace concurrency control (412 si cambió).
   */
  async function push({ ifMatch = null } = {}) {
    if (!ApiClient.isConfigured()) throw new Error("Backend no configurado");
    if (!ApiClient.isAuthenticated()) throw new Error("No autenticado en el backend");
    // Flush pending writes antes de subir
    await Storage.persistNow();
    const blob = await getLocalBlob();
    if (!blob) throw new Error("No hay datos locales para subir");

    try {
      const result = await ApiClient.pushDatabase(blob, { ifMatch });
      Storage.setSettings({ lastSyncPush: result.updated || new Date().toISOString() });
      return { ok: true, action: "push", ...result };
    } catch (e) {
      if (e.name === "ConflictError") {
        return {
          ok: false,
          action: "conflict",
          code: "CONFLICT",
          remoteEtag: e.currentEtag,
          remoteUpdated: e.currentUpdated,
          remoteSize: e.currentSize,
        };
      }
      throw e;
    }
  }

  /**
   * Descarga el blob cifrado del server y lo guarda en IDB (reemplaza local).
   * IMPORTANTE: requiere confirmación previa del usuario en la UI.
   */
  async function pull({ force = false } = {}) {
    if (!ApiClient.isConfigured()) throw new Error("Backend no configurado");
    if (!ApiClient.isAuthenticated()) throw new Error("No autenticado en el backend");
    const remote = await ApiClient.pullDatabase();
    if (!remote) throw new Error("No hay datos en el servidor");

    // Guardar el blob en IDB (sin descifrar — sigue siendo el blob cifrado)
    if (typeof Storage.replaceIdbBlob === "function") {
      await Storage.replaceIdbBlob(remote.blob);
    } else {
      throw new Error("Storage.replaceIdbBlob no disponible");
    }
    Storage.setSettings({
      lastSyncPull: remote.updated || new Date().toISOString(),
      lastRemoteEtag: remote.etag,
    });
    return {
      ok: true,
      action: "pull",
      etag: remote.etag,
      version: remote.version,
      size: remote.size,
      updated: remote.updated,
    };
  }

  /**
   * Sincroniza automáticamente. Lógica:
   * 1. HEAD remoto → metadata (etag, updatedAt, size)
   * 2. Si no existe remoto → push local
   * 3. Si no existe local pero sí remoto → pull (requiere password para descifrar)
   * 4. Si ambos existen:
   *    a. Si remote.updated > local lastSync → pull
   *    b. Else → push
   * Devuelve { ok, action, ... }.
   * Conflict → resuelve con last-write-wins basado en timestamp.
   */
  async function sync() {
    if (!ApiClient.isConfigured()) throw new Error("Backend no configurado");
    if (!ApiClient.isAuthenticated()) throw new Error("No autenticado en el backend");

    const remoteMeta = await getRemoteMeta();
    const localBlob = await getLocalBlob();
    const settings = Storage.getSettings();
    const lastSyncPush = settings.lastSyncPush;
    const lastRemoteEtag = settings.lastRemoteEtag;

    // Caso 1: no hay local → pull
    if (!localBlob) {
      // Si no hay remote tampoco, nada que hacer
      if (!remoteMeta) {
        return { ok: true, action: "noop", reason: "no local ni remote" };
      }
      const result = await pull();
      return { ...result, reason: "pulled_from_remote" };
    }

    // Caso 2: no hay remote → push local
    if (!remoteMeta) {
      const result = await push();
      return { ...result, reason: "pushed_to_empty_remote" };
    }

    // Caso 3: ambos existen
    // Mismo etag → nada que hacer
    if (lastRemoteEtag && lastRemoteEtag === remoteMeta.etag) {
      return { ok: true, action: "noop", reason: "same_etag" };
    }

    // Comparar timestamps: si el remoto es más nuevo → pull
    const remoteUpdated = remoteMeta.updated ? new Date(remoteMeta.updated).getTime() : 0;
    const localUpdated = lastSyncPush ? new Date(lastSyncPush).getTime() : 0;

    if (remoteUpdated > localUpdated) {
      const result = await pull();
      return { ...result, reason: "remote_newer" };
    } else {
      // Local más nuevo → push (con ifMatch para detectar pisadas concurrentes)
      const result = await push({ ifMatch: remoteMeta.etag });
      if (result.action === "conflict") {
        // Otro device escribió mientras tanto → recargar y reintentar una vez
        const retryPush = await push({ ifMatch: result.remoteEtag });
        return { ...retryPush, reason: "conflict_resolved_retry" };
      }
      return { ...result, reason: "local_newer" };
    }
  }

  /**
   * Verifica conectividad con el backend + que el token sea válido.
   */
  async function testConnection() {
    if (!ApiClient.isConfigured()) {
      throw new Error("Backend no configurado. Configurá la URL primero.");
    }
    // 1. Health check
    try {
      await ApiClient.health();
    } catch (e) {
      throw new Error(`No se pudo conectar: ${e.message}`);
    }
    // 2. Si hay token, verificar que sigue válido
    if (ApiClient.isAuthenticated()) {
      try {
        await ApiClient.getMe();
      } catch (e) {
        throw new Error(`Autenticación inválida: ${e.message}`);
      }
    }
    return { ok: true };
  }

  return {
    getLocalBlob, getRemoteMeta,
    push, pull, sync,
    testConnection,
  };
})();