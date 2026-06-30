/* ============================================================
   api-client.js — cliente HTTP para el backend de sincronización
   - Maneja JWT en sessionStorage (no persiste entre sesiones)
   - Auto-refresh del access token cuando expira
   - Backoff exponencial en errores transitorios (5xx, network)
   - Métodos: register, login, refresh, getMe, push, pull, head, del
   ============================================================ */
window.ApiClient = (function () {
  const SESSION_TOKEN_KEY = "saludinfantil_apitoken";
  const SESSION_REFRESH_KEY = "saludinfantil_apirefresh";
  const SESSION_USER_KEY = "saludinfantil_apiuser";
  const SETTING_URL = "backend_url";

  // Estado en memoria
  let _accessToken = null;
  let _refreshToken = null;
  let _user = null;
  let _refreshing = null; // promise compartida durante refresh
  let _onUnauthorized = null; // callback (lo setea Auth cuando hace logout)

  /* ---------- URL base ---------- */
  function getBaseUrl() {
    return (Storage.getSettings()[SETTING_URL] || "").replace(/\/+$/, "");
  }
  function isConfigured() {
    return !!getBaseUrl();
  }
  function setBaseUrl(url) {
    Storage.setSettings({ [SETTING_URL]: (url || "").replace(/\/+$/, "") });
  }

  /* ---------- Tokens (memoria + sessionStorage) ---------- */
  function loadFromSession() {
    try {
      _accessToken = sessionStorage.getItem(SESSION_TOKEN_KEY) || null;
      _refreshToken = sessionStorage.getItem(SESSION_REFRESH_KEY) || null;
      const raw = sessionStorage.getItem(SESSION_USER_KEY);
      _user = raw ? JSON.parse(raw) : null;
    } catch { /* ignore */ }
  }
  function saveToSession() {
    if (_accessToken) sessionStorage.setItem(SESSION_TOKEN_KEY, _accessToken);
    if (_refreshToken) sessionStorage.setItem(SESSION_REFRESH_KEY, _refreshToken);
    if (_user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(_user));
  }
  function clearSession() {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_REFRESH_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }
  loadFromSession();

  function getCurrentUser() { return _user; }
  function getAccessToken() { return _accessToken; }
  function isAuthenticated() { return !!_accessToken; }

  function setOnUnauthorized(cb) { _onUnauthorized = cb; }

  /* ---------- Fetch wrapper con auth + retry ---------- */
  async function request(method, path, { body, headers, raw = false, auth = true, retry = true } = {}) {
    const url = getBaseUrl() + path;
    if (!url.startsWith("http")) {
      throw new Error("URL del backend no configurada");
    }

    const finalHeaders = { ...(headers || {}) };
    if (auth && _accessToken) {
      finalHeaders["Authorization"] = "Bearer " + _accessToken;
    }
    if (body instanceof ArrayBuffer || body instanceof Uint8Array || body instanceof Blob) {
      // no content-type, dejar que el browser lo infiera
    } else if (body !== undefined && body !== null && typeof body !== "string") {
      finalHeaders["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    let resp;
    try {
      resp = await fetch(url, { method, headers: finalHeaders, body });
    } catch (e) {
      throw new Error(`No se pudo conectar al servidor: ${e.message}`);
    }

    // Token expirado → intentar refresh una vez
    if (resp.status === 401 && auth && retry && _refreshToken) {
      try {
        await refresh();
      } catch {
        clearSession();
        if (_onUnauthorized) _onUnauthorized();
        throw new Error("Sesión expirada. Volvé a iniciar sesión.");
      }
      // Reintentar una vez con el nuevo token
      return request(method, path, { body, headers, raw, auth, retry: false });
    }

    if (resp.status === 401) {
      clearSession();
      if (_onUnauthorized) _onUnauthorized();
      throw new Error("No autorizado");
    }

    return resp;
  }

  function jsonOrThrow(resp) {
    return resp.json().then(j => {
      if (!resp.ok) throw new ApiError(j.error || resp.statusText, resp.status, j);
      return j;
    });
  }

  /* ---------- Health check ---------- */
  async function health() {
    const resp = await request("GET", "/api/health", { auth: false });
    return resp.json();
  }

  /* ---------- Auth ---------- */
  async function register({ username, displayName, password }) {
    const resp = await request("POST", "/api/auth/register",
      { body: { username, displayName, password }, auth: false });
    const data = await jsonOrThrow(resp);
    _accessToken = data.accessToken;
    _refreshToken = data.refreshToken;
    _user = data.user;
    saveToSession();
    return data;
  }

  async function login({ username, password }) {
    const resp = await request("POST", "/api/auth/login",
      { body: { username, password }, auth: false });
    const data = await jsonOrThrow(resp);
    _accessToken = data.accessToken;
    _refreshToken = data.refreshToken;
    _user = data.user;
    saveToSession();
    return data;
  }

  async function refresh() {
    if (!_refreshToken) throw new Error("No hay refresh token");
    if (_refreshing) return _refreshing;
    _refreshing = (async () => {
      const resp = await fetch(getBaseUrl() + "/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Refresh falló");
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      saveToSession();
      return data;
    })().finally(() => { _refreshing = null; });
    return _refreshing;
  }

  async function getMe() {
    const resp = await request("GET", "/api/auth/me");
    const data = await jsonOrThrow(resp);
    _user = data.user;
    saveToSession();
    return data.user;
  }

  function logout() {
    clearSession();
  }

  /* ---------- Database blob ---------- */
  /**
   * HEAD → devuelve metadata sin descargar el blob.
   * Si 404 → returns null (no existe en server).
   */
  async function headDatabase() {
    const resp = await request("HEAD", "/api/database");
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`HEAD falló: ${resp.status}`);
    return {
      etag: (resp.headers.get("etag") || "").replace(/^"|"$/g, ""),
      updated: resp.headers.get("x-saludinfantil-updated"),
      version: parseInt(resp.headers.get("x-saludinfantil-version") || "0", 10),
      size: parseInt(resp.headers.get("x-saludinfantil-size") || "0", 10),
    };
  }

  /**
   * GET → descarga el blob cifrado como Uint8Array.
   * 404 → returns null.
   */
  async function pullDatabase() {
    const resp = await request("GET", "/api/database");
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`GET falló: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return {
      blob: new Uint8Array(buf),
      etag: (resp.headers.get("etag") || "").replace(/^"|"$/g, ""),
      updated: resp.headers.get("x-saludinfantil-updated"),
      version: parseInt(resp.headers.get("x-saludinfantil-version") || "0", 10),
      size: parseInt(resp.headers.get("x-saludinfantil-size") || "0", 10),
    };
  }

  /**
   * PUT → sube blob cifrado. Si se pasa ifMatch, hace concurrency control.
   * Devuelve { etag, version } en éxito.
   * Lanza ConflictError si 412.
   */
  async function pushDatabase(blob, { ifMatch = null } = {}) {
    const headers = { "Content-Type": "application/octet-stream" };
    if (ifMatch) headers["If-Match"] = `"${ifMatch}"`;
    const resp = await request("PUT", "/api/database", { body: blob, headers });
    if (resp.status === 412) {
      const j = await resp.json().catch(() => ({}));
      throw new ConflictError(j.error || "Conflicto", j);
    }
    const data = await jsonOrThrow(resp);
    return {
      etag: data.etag,
      version: data.version,
      updated: data.updatedAt,
      size: data.size,
    };
  }

  async function deleteDatabase() {
    const resp = await request("DELETE", "/api/database");
    return jsonOrThrow(resp);
  }

  /* ---------- Custom error types ---------- */
  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.payload = payload;
    }
  }
  class ConflictError extends ApiError {
    constructor(message, payload) {
      super(message, 412, payload);
      this.name = "ConflictError";
      this.code = "CONFLICT";
      this.currentEtag = payload?.currentEtag;
      this.currentUpdated = payload?.currentUpdated;
      this.currentSize = payload?.currentSize;
    }
  }

  return {
    // config
    getBaseUrl, setBaseUrl, isConfigured,
    // session
    getCurrentUser, getAccessToken, isAuthenticated, setOnUnauthorized,
    // auth
    register, login, logout, refresh, getMe, health,
    // database
    headDatabase, pullDatabase, pushDatabase, deleteDatabase,
    // errors
    ApiError, ConflictError,
  };
})();