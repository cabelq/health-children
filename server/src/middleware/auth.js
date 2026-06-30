/* ============================================================
   middleware/auth.js — verifica JWT y expone req.user
   ============================================================ */
'use strict';

const { verifyToken } = require('../auth/jwt');

function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const payload = verifyToken(m[1]);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };