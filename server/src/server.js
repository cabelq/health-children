/* ============================================================
   server.js — entry point
   SaludInfantil sync server (Node.js + Express + SQLite)
   - Server OPACO: nunca descifra la DB. Solo guarda bytes cifrados.
   - Auth con JWT + bcrypt para los hashes server-side.
   - Endpoints RESTful con ETag para evitar pisadas.
   ============================================================ */
'use strict';

require('dotenv').config();
const app = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.log(`[server] SaludInfantil server corriendo en http://localhost:${PORT}`);
  console.log(`[server] Entorno: ${NODE_ENV}`);
  console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
});

// Cierre limpio
function shutdown(signal) {
  console.log(`\n[server] Señal ${signal} recibida, cerrando...`);
  server.close(() => {
    console.log('[server] HTTP server cerrado.');
    process.exit(0);
  });
  // Forzar salida después de 10s
  setTimeout(() => {
    console.error('[server] Cierre forzado.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch de errores no manejados (no crashear el server)
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException');
});