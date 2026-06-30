/* ============================================================
   routes/database.js — /api/database (blob cifrado opaco)
   - GET  /api/database          → descargar blob + etag
   - HEAD /api/database          → solo etag + timestamp
   - PUT  /api/database          → subir blob (con If-Match opcional)
   - POST /api/database          → crear si no existe
   - DELETE /api/database        → borrar
   ---------------------------------------------
   El server NUNCA descifra el blob. Solo calcula su hash para ETag.
   ============================================================ */
'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const MAX_BLOB_SIZE = parseInt(process.env.MAX_BLOB_SIZE || '52428800', 10); // 50MB

// Raw parser para el body binario (solo PUT/POST)
function rawBodyParser(req, res, next) {
  express.raw({
    type: 'application/octet-stream',
    limit: MAX_BLOB_SIZE,
  })(req, res, err => {
    if (err) return next(err);
    next();
  });
}

/* ---------- Helpers ---------- */
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isValidEncryptedMarker(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  return buf.subarray(0, 4).toString('ascii') === 'ENC1';
}

function getDatabaseRow(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM databases WHERE userId = ?').get(userId);
}

/* ---------- GET /api/database ----------
   Devuelve el blob cifrado + headers con etag + timestamp.
   404 si no existe.
   --------------------------------------------- */
router.get('/', authenticate, (req, res) => {
  const row = getDatabaseRow(req.user.id);
  if (!row) {
    return res.status(404).json({
      error: 'No hay base de datos en el servidor',
      code: 'NOT_FOUND',
    });
  }
  res.set({
    'ETag': `"${row.etag}"`,
    'X-SaludInfantil-Version': row.version.toString(),
    'X-SaludInfantil-Updated': row.updatedAt,
    'X-SaludInfantil-Size': row.size.toString(),
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.send(row.blob);
});

/* ---------- HEAD /api/database ----------
   Solo metadata (etag, timestamp, size).
   --------------------------------------------- */
router.head('/', authenticate, (req, res) => {
  const row = getDatabaseRow(req.user.id);
  if (!row) return res.status(404).end();
  res.set({
    'ETag': `"${row.etag}"`,
    'X-SaludInfantil-Version': row.version.toString(),
    'X-SaludInfantil-Updated': row.updatedAt,
    'X-SaludInfantil-Size': row.size.toString(),
  });
  res.status(200).end();
});

/* ---------- PUT /api/database ----------
   Sube el blob cifrado. Soporta concurrency control con If-Match.
   - Si If-Match se manda y no coincide → 412 Precondition Failed
   - Si no se manda → siempre sobreescribe (last-write-wins)
   Body: bytes cifrados (application/octet-stream)
   --------------------------------------------- */
router.put('/', authenticate, rawBodyParser, (req, res, next) => {
  try {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: 'Body vacío' });
    }
    if (buf.length > MAX_BLOB_SIZE) {
      return res.status(413).json({
        error: 'Blob demasiado grande',
        maxBytes: MAX_BLOB_SIZE,
        actualBytes: buf.length,
      });
    }
    // Validación mínima: marker ENC1 al inicio
    if (!isValidEncryptedMarker(buf)) {
      return res.status(400).json({
        error: 'El blob no parece estar cifrado (falta marker ENC1)',
        code: 'INVALID_MARKER',
      });
    }

    const db = getDb();
    const existing = getDatabaseRow(req.user.id);
    const ifMatch = req.headers['if-match'];
    const newEtag = sha256(buf);
    const now = new Date().toISOString();

    // Concurrency control
    if (ifMatch && existing) {
      const expected = ifMatch.replace(/^"|"$/g, '');
      if (expected !== existing.etag) {
        return res.status(412).json({
          error: 'Conflicto: el blob remoto cambió desde la última lectura',
          code: 'PRECONDITION_FAILED',
          currentEtag: existing.etag,
          currentUpdated: existing.updatedAt,
          currentSize: existing.size,
        });
      }
    }

    if (existing) {
      db.prepare(`
        UPDATE databases
        SET blob = ?, etag = ?, size = ?, version = version + 1, updatedAt = ?
        WHERE userId = ?
      `).run(buf, newEtag, buf.length, now, req.user.id);
    } else {
      db.prepare(`
        INSERT INTO databases (userId, blob, etag, size, version, updatedAt, createdAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(req.user.id, buf, newEtag, buf.length, now, now);
    }

    res.status(200).json({
      ok: true,
      etag: newEtag,
      version: (existing?.version || 0) + 1,
      size: buf.length,
      updatedAt: now,
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- DELETE /api/database ----------
   Borra el blob del server (pide confirmación con If-Match opcional).
   --------------------------------------------- */
router.delete('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const existing = getDatabaseRow(req.user.id);
    if (!existing) return res.status(404).json({ error: 'No existe la base de datos' });

    const ifMatch = req.headers['if-match'];
    if (ifMatch) {
      const expected = ifMatch.replace(/^"|"$/g, '');
      if (expected !== existing.etag) {
        return res.status(412).json({ error: 'Conflicto' });
      }
    }
    db.prepare('DELETE FROM databases WHERE userId = ?').run(req.user.id);
    res.json({ ok: true, deleted: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;