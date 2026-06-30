/* ============================================================
   Crypto — cifrado AES-GCM de la DB + backups
   - Key derivation: PBKDF2-SHA256, 600k iteraciones (OWASP 2024)
   - Cifrado autenticado: AES-GCM-256 (detecta tampering)
   - Salt por DB, almacenado por separado (no en el blob)
   - Marker "ENC1" al inicio del blob para distinguir de DBs viejas
   ============================================================ */
window.Crypto = (function () {
  const PBKDF2_ITER = 600000;
  const KEY_LENGTH_BITS = 256;
  const IV_BYTES = 12;
  const SALT_BYTES = 16;
  const ENC_MARKER = "ENC1";

  /* ---------- hex / base64 helpers ---------- */
  function toHex(bytes) {
    return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function fromHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function toB64(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = "";
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }
  function fromB64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Convierte a Uint8Array (acepta Uint8Array, ArrayBuffer, o similar) */
  function toU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    throw new Error("Tipo no soportado para bytes");
  }

  /* ---------- key derivation ---------- */
  async function deriveKey(password, saltHex) {
    if (!password) throw new Error("Password requerido");
    if (!saltHex) throw new Error("Salt requerido");
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: fromHex(saltHex),
        iterations: PBKDF2_ITER,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: KEY_LENGTH_BITS },
      true, // extractable (para cachear en sessionStorage)
      ["encrypt", "decrypt"]
    );
  }

  async function exportKey(cryptoKey) {
    const raw = await crypto.subtle.exportKey("raw", cryptoKey);
    return toB64(raw);
  }
  async function importKey(b64) {
    return crypto.subtle.importKey(
      "raw", fromB64(b64),
      { name: "AES-GCM", length: KEY_LENGTH_BITS },
      true, ["encrypt", "decrypt"]
    );
  }

  /* ---------- cifrado directo con CryptoKey (DB en memoria) ---------- */
  /**
   * Cifra bytes usando la CryptoKey directamente. El IV es aleatorio.
   * Formato: [marker (4)] [iv (12)] [ciphertext+tag]
   */
  async function encryptBytesWithKey(plaintext, cryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plaintext);
    const ctBytes = new Uint8Array(ct);
    const out = new Uint8Array(ENC_MARKER.length + IV_BYTES + ctBytes.length);
    const enc = new TextEncoder();
    out.set(enc.encode(ENC_MARKER), 0);
    out.set(iv, ENC_MARKER.length);
    out.set(ctBytes, ENC_MARKER.length + IV_BYTES);
    return out;
  }

  async function decryptBytesWithKey(blob, cryptoKey) {
    const enc = new TextEncoder();
    const markerBytes = enc.encode(ENC_MARKER);
    if (blob.length < markerBytes.length + IV_BYTES) {
      throw new Error("Blob demasiado chico para estar cifrado");
    }
    for (let i = 0; i < markerBytes.length; i++) {
      if (blob[i] !== markerBytes[i]) throw new Error("Marker de cifrado inválido");
    }
    const iv = blob.slice(markerBytes.length, markerBytes.length + IV_BYTES);
    const ciphertext = blob.slice(markerBytes.length + IV_BYTES);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
    return new Uint8Array(pt);
  }

  function isEncrypted(blob) {
    if (!blob || blob.length < ENC_MARKER.length) return false;
    const enc = new TextEncoder();
    const m = enc.encode(ENC_MARKER);
    for (let i = 0; i < m.length; i++) if (blob[i] !== m[i]) return false;
    return true;
  }

  /** Variante de encryptBytesWithKey que devuelve base64 directamente */
  async function encryptBytesWithKeyAsB64(plaintext, cryptoKey) {
    const blob = await encryptBytesWithKey(plaintext, cryptoKey);
    return toB64(blob);
  }
  async function decryptBytesWithKeyFromB64(cipherB64, cryptoKey) {
    const blob = fromB64(cipherB64);
    return decryptBytesWithKey(blob, cryptoKey);
  }

  /* ---------- cifrado genérico (para backups, sin clave en memoria) ---------- */
  /** Genera un salt aleatorio en hex (32 chars = 16 bytes) */
  function generateSalt() {
    return toHex(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  }

  /**
   * Cifra un texto con una password. El salt se guarda en el blob (formato autosuficiente).
   * Formato: [marker (4)] [salt (16)] [iv (12)] [ciphertext+tag]
   */
  async function encryptTextWithPassword(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(password, toHex(salt));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    const ctBytes = new Uint8Array(ct);
    const out = new Uint8Array(ENC_MARKER.length + SALT_BYTES + IV_BYTES + ctBytes.length);
    const enc = new TextEncoder();
    out.set(enc.encode(ENC_MARKER), 0);
    out.set(salt, ENC_MARKER.length);
    out.set(iv, ENC_MARKER.length + SALT_BYTES);
    out.set(ctBytes, ENC_MARKER.length + SALT_BYTES + IV_BYTES);
    return toB64(out);
  }

  async function decryptTextWithPassword(cipherB64, password) {
    const blob = fromB64(cipherB64);
    const enc = new TextEncoder();
    const markerBytes = enc.encode(ENC_MARKER);
    if (blob.length < markerBytes.length + SALT_BYTES + IV_BYTES) {
      throw new Error("Blob cifrado inválido");
    }
    for (let i = 0; i < markerBytes.length; i++) {
      if (blob[i] !== markerBytes[i]) throw new Error("Marker inválido");
    }
    const salt = blob.slice(markerBytes.length, markerBytes.length + SALT_BYTES);
    const iv = blob.slice(markerBytes.length + SALT_BYTES, markerBytes.length + SALT_BYTES + IV_BYTES);
    const ciphertext = blob.slice(markerBytes.length + SALT_BYTES + IV_BYTES);
    const key = await deriveKey(password, toHex(salt));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(pt);
  }

  return {
    PBKDF2_ITER,
    KEY_LENGTH_BITS,
    SALT_BYTES,
    IV_BYTES,
    ENC_MARKER,
    deriveKey,
    exportKey,
    importKey,
    encryptBytesWithKey,
    decryptBytesWithKey,
    encryptBytesWithKeyAsB64,
    decryptBytesWithKeyFromB64,
    encryptTextWithPassword,
    decryptTextWithPassword,
    isEncrypted,
    generateSalt,
    toHex,
    fromHex,
    toB64,
    fromB64,
  };
})();