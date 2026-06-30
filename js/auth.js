/* ============================================================
   Auth — autenticación local + sync con backend opcional
   - Hash de password con PBKDF2-SHA256 (100k iteraciones)
   - Sesión en sessionStorage (se cierra al cerrar el navegador)
   - Roles: admin | member | viewer
   - Backend opcional: si ApiClient.isConfigured(), también
     autentica contra el server (JWT) y sincroniza la DB.
   ============================================================ */
window.Auth = (function () {
  const SESSION_KEY = "saludinfantil_session";
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas
  const PBKDF2_ITER = 100000;

  function toHex(buf) {
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function fromHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  /** Genera salt aleatorio (16 bytes) */
  function generateSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return toHex(arr);
  }

  /** Hashea password con PBKDF2-SHA256 */
  async function hashPassword(password, saltHex) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromHex(saltHex),
        iterations: PBKDF2_ITER,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    return toHex(bits);
  }

  /* ---------- API ---------- */

  /** ¿Hay usuarios registrados localmente? */
  function hasUsers() {
    return Storage.countUsers() > 0;
  }

  /**
   * Registra el primer usuario (o usuarios adicionales).
   * Si ApiClient.isConfigured(), también registra contra el backend.
   */
  async function register({ username, displayName, password, role = "member", syncWithBackend = null }) {
    if (!username || !displayName || !password) throw new Error("Datos incompletos");
    if (password.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres");
    if (Storage.getUserByUsername(username)) throw new Error("El usuario ya existe");

    // Si se debe sincronizar con backend (auto: si está configurado)
    const useBackend = syncWithBackend !== null
      ? syncWithBackend
      : (typeof ApiClient !== "undefined" && ApiClient.isConfigured());

    if (useBackend && typeof ApiClient !== "undefined") {
      try {
        const r = await ApiClient.register({ username, displayName, password });
        // Si el server aceptó, también creamos el user local con el mismo id
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        const isFirstAdmin = role === "admin" && Storage.countUsers() === 0;
        if (isFirstAdmin) {
          await Storage.enableEncryption(password);
        }
        return Storage.addUser({
          id: r.user.id,            // usar el mismo id que el server
          username,
          displayName,
          passwordHash,
          salt,
          role,
        });
      } catch (e) {
        // Si falla el server, igual dejamos crear local (modo offline-first)
        console.warn("[Auth] register en backend falló, registrando solo local:", e.message);
      }
    }

    // Modo local-only (sin backend)
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const isFirstAdmin = role === "admin" && Storage.countUsers() === 0;
    if (isFirstAdmin) {
      await Storage.enableEncryption(password);
    }
    return Storage.addUser({ username, displayName, passwordHash, salt, role });
  }

  /**
   * Intenta login.
   * Si hay backend configurado, primero valida contra el server (JWT).
   * Luego desbloquea la DB cifrada local con la password.
   * Flujo de primera vez con backend:
   *   1. POST /api/auth/login → JWT
   *   2. GET /api/database → si hay blob, descargar y reemplazar local
   *   3. Storage.unlock(blobDescifrado, password) → DB en memoria
   *   4. Si no hay blob remoto, usar local + upload inicial
   */
  async function login(username, password) {
    // 1. Validar contra el backend si está configurado
    let backendOk = false;
    if (typeof ApiClient !== "undefined" && ApiClient.isConfigured()) {
      try {
        await ApiClient.login({ username, password });
        backendOk = true;
      } catch (e) {
        // Si el server rechaza, igual dejamos intentar offline
        // (útil si el server está caído pero vos ya tenías sesión local)
        console.warn("[Auth] backend login falló:", e.message);
      }
    }

    // 2. Validar contra el hash local
    const user = Storage.getUserByUsername(username);
    if (!user) {
      if (backendOk) {
        // Tenemos el user en backend pero no local. Crearlo con un salt nuevo.
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        Storage.addUser({
          username,
          displayName: ApiClient.getCurrentUser()?.displayName || username,
          passwordHash,
          salt,
          role: ApiClient.getCurrentUser()?.role || "admin",
        });
        return await finishLogin(username, password, { createdLocal: true });
      }
      return null;
    }
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      // Si el server validó OK pero el local no, sincronizar el hash local con el del server
      // (no podemos — server guarda bcrypt, nosotros PBKDF2). Mejor: error claro.
      if (backendOk) {
        throw new Error("Credenciales válidas en el server pero inválidas localmente. Contactá al admin.");
      }
      return null;
    }

    return await finishLogin(username, password, { backendOk });
  }

  async function finishLogin(username, password, { backendOk = false, createdLocal = false } = {}) {
    const user = Storage.getUserByUsername(username);
    if (!user) return null;

    // Si hay backend y está autenticado, intentar traer la DB remota
    let downloadedFromRemote = false;
    if (backendOk && typeof ApiClient !== "undefined" && ApiClient.isAuthenticated()) {
      try {
        const remoteMeta = await ApiClient.headDatabase();
        if (remoteMeta) {
          // Hay blob remoto → descargar y reemplazar local
          const remote = await ApiClient.pullDatabase();
          if (remote && typeof Storage.replaceIdbBlob === "function") {
            await Storage.replaceIdbBlob(remote.blob);
            downloadedFromRemote = true;
            Storage.setSettings({
              lastSyncPull: remote.updated,
              lastRemoteEtag: remote.etag,
            });
          }
        }
      } catch (e) {
        console.warn("[Auth] no se pudo traer DB remota:", e.message);
      }
    }

    // Desbloquear la DB con la password (la cifra si era legacy sin cifrar)
    try {
      await Storage.unlock(password);
    } catch (e) {
      console.warn("[Auth] unlock failed:", e.message);
      return null;
    }

    Storage.updateUserLastLogin(user.id);

    // Si acabamos de descargar remoto, no subimos inmediatamente.
    // Si no había remoto pero sí local, subir la local (primer sync).
    if (backendOk && !downloadedFromRemote && typeof CloudSync !== "undefined") {
      CloudSync.push?.().catch(e => console.warn("[Auth] push inicial falló:", e.message));
    }

    const session = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      expiresAt: Date.now() + SESSION_DURATION,
      backend: backendOk,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return getCurrentUser();
  }

  /** Devuelve el usuario actual o null si no hay sesión válida */
  function getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session.expiresAt || session.expiresAt < Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /** Cierra la sesión (local + backend) */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    Storage.clearEncryptionKey();
    if (typeof ApiClient !== "undefined") ApiClient.logout();
  }

  /** Extiende la sesión actual (sliding expiration) */
  function refresh() {
    const session = getCurrentUser();
    if (session) {
      session.expiresAt = Date.now() + SESSION_DURATION;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  /** Helpers de permisos */
  function isAdmin() { const u = getCurrentUser(); return u && u.role === "admin"; }
  function isMember() { const u = getCurrentUser(); return u && (u.role === "admin" || u.role === "member"); }
  function isViewer() { const u = getCurrentUser(); return u && (u.role === "admin" || u.role === "member" || u.role === "viewer"); }
  function canEdit() { return isMember(); }
  function canManageUsers() { return isAdmin(); }

  /** ¿Hay sesión backend activa? */
  function hasBackendSession() {
    return typeof ApiClient !== "undefined" && ApiClient.isAuthenticated();
  }

  return {
    register, login, logout, getCurrentUser, refresh, hasUsers,
    isAdmin, isMember, isViewer, canEdit, canManageUsers,
    hasBackendSession,
    hashPassword, generateSalt,
  };
})();