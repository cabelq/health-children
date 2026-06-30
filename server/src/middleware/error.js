/* ============================================================
   middleware/error.js — manejo centralizado de errores
   ============================================================ */
'use strict';

function notFound(req, res, next) {
  res.status(404).json({ error: 'Endpoint no encontrado', path: req.path });
}

function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  // Errores de SQLite
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({ error: 'Error de base de datos', code: err.code });
  }

  // Payload demasiado grande
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Blob demasiado grande', maxBytes: err.limit });
  }

  // Errores de body parser
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  // Error genérico
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

module.exports = { errorHandler, notFound };