/* ============================================================
   routes/auth.js — /api/auth/register | login | refresh | me
   ============================================================ */
'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();

const { getDb } = require('../db');
const { signAccessToken, signRefreshToken, verifyToken } = require('../auth/jwt');
const { authenticate } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;

/* ---------- Helpers ---------- */
function uid() {
  return crypto.randomBytes(16).toString('hex');
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
  };
}

function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 4) {
    throw Object.assign(new Error('La contraseña debe tener al menos 4 caracteres'), { status: 400 });
  }
  if (p.length > 1024) {
    throw Object.assign(new Error('Contraseña demasiado larga'), { status: 400 });
  }
}

function validateUsername(u) {
  if (typeof u !== 'string' || !/^[a-zA-Z0-9_-]{3,32}$/.test(u)) {
    throw Object.assign(new Error('Username debe ser alfanumérico (3-32 chars)'), { status: 400 });
  }
}

/* ---------- POST /api/auth/register ----------
   Crea cuenta nueva. El server NO sabe la clave de cifrado de la DB
   (esa vive en el cliente). El server solo guarda el hash bcrypt
   del password para autenticar al usuario.
   Body: { username, displayName, password }
   --------------------------------------------- */
router.post('/register', async (req, res, next) => {
  try {
    const { username, displayName, password } = req.body || {};
    validateUsername(username);
    if (!displayName || typeof displayName !== 'string') {
      throw Object.assign(new Error('displayName requerido'), { status: 400 });
    }
    validatePassword(password);

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      throw Object.assign(new Error('El usuario ya existe'), { status: 409 });
    }

    const id = uid();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // encryptionSalt es generado por el cliente (NO se usa acá, queda para futuro)
    // Lo dejamos en null por ahora — el cliente cifra la DB localmente y sube el blob.
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, displayName, passwordHash, encryptionSalt, role, createdAt)
      VALUES (?, ?, ?, ?, NULL, 'admin', ?)
    `).run(id, username, displayName, passwordHash, createdAt);

    const user = { id, username, displayName, role: 'admin', createdAt, lastLogin: null };
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(201).json({
      user: publicUser(user),
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '900', 10),
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST /api/auth/login ----------
   Body: { username, password }
   --------------------------------------------- */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw Object.assign(new Error('username y password requeridos'), { status: 400 });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    // Mismo error para "no existe" y "password mal" → no filtrar info
    if (!user) {
      throw Object.assign(new Error('Usuario o contraseña incorrectos'), { status: 401 });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw Object.assign(new Error('Usuario o contraseña incorrectos'), { status: 401 });
    }

    const lastLogin = new Date().toISOString();
    db.prepare('UPDATE users SET lastLogin = ? WHERE id = ?').run(lastLogin, user.id);

    const publicU = { ...publicUser(user), lastLogin };
    const accessToken = signAccessToken(publicU);
    const refreshToken = signRefreshToken(publicU);

    res.json({
      user: publicU,
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '900', 10),
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST /api/auth/refresh ----------
   Body: { refreshToken }
   --------------------------------------------- */
router.post('/refresh', (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      throw Object.assign(new Error('refreshToken requerido'), { status: 400 });
    }
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
      throw Object.assign(new Error('Token no es de tipo refresh'), { status: 401 });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      throw Object.assign(new Error('Usuario no encontrado'), { status: 401 });
    }
    const accessToken = signAccessToken(user);
    const refreshTokenNew = signRefreshToken(user);
    res.json({
      accessToken,
      refreshToken: refreshTokenNew,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '900', 10),
    });
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expirado', code: 'REFRESH_EXPIRED' });
    }
    next(e);
  }
});

/* ---------- GET /api/auth/me ----------
   Devuelve info del usuario actual (requiere token).
   --------------------------------------------- */
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;