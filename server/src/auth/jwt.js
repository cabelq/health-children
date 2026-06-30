/* ============================================================
   auth/jwt.js — sign / verify con HS256
   ============================================================ */
'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
  }
  console.warn('[jwt] ADVERTENCIA: JWT_SECRET no configurado o demasiado corto. Generá uno con `openssl rand -hex 64`.');
}

const ACCESS_TTL = parseInt(process.env.JWT_EXPIRES_IN || '900', 10);
const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, type: 'access' },
    SECRET,
    { expiresIn: ACCESS_TTL, algorithm: 'HS256' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    SECRET,
    { expiresIn: REFRESH_TTL, algorithm: 'HS256' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  ACCESS_TTL,
  REFRESH_TTL,
};