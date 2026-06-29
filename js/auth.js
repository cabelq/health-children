/* ============================================================
   Auth — autenticación local con PBKDF2 y sesiones
   - Hash de password con PBKDF2-SHA256 (100k iteraciones)
   - Sesión en sessionStorage (se cierra al cerrar el navegador)
   - Roles: admin | member | viewer
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

  /** ¿Hay usuarios registrados? */
  function hasUsers() {
    return Storage.countUsers() > 0;
  }

  /**
   * Registra el primer usuario (o usuarios adicionales)
   * @param {string} username
   * @param {string} displayName
   * @param {string} password
   * @param {"admin"|"member"|"viewer"} role
   */
  async function register({ username, displayName, password, role = "member" }) {
    if (!username || !displayName || !password) throw new Error("Datos incompletos");
    if (password.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres");
    if (Storage.getUserByUsername(username)) throw new Error("El usuario ya existe");
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    return Storage.addUser({ username, displayName, passwordHash, salt, role });
  }

  /** Intenta login. Devuelve el usuario si OK, null si falla */
  async function login(username, password) {
    const user = Storage.getUserByUsername(username);
    if (!user) return null;
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return null;
    Storage.updateUserLastLogin(user.id);
    const session = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      expiresAt: Date.now() + SESSION_DURATION,
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

  /** Cierra la sesión */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
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

  return {
    register, login, logout, getCurrentUser, refresh, hasUsers,
    isAdmin, isMember, isViewer, canEdit, canManageUsers,
    hashPassword, generateSalt,
  };
})();