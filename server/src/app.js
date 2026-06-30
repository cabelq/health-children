/* ============================================================
   app.js — Express app + middleware + rutas
   ============================================================ */
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const auth = require('./routes/auth');
const database = require('./routes/database');
const { errorHandler, notFound } = require('./middleware/error');
const { initDb } = require('./db');

// Inicializar DB al arrancar (sync, antes de acceptar requests)
initDb();

const app = express();

/* ---------- Middleware global ---------- */
const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: corsOrigins.includes('*') ? true : corsOrigins,
  credentials: true,
}));

// JSON parser (excepto /api/database que va como raw)
app.use((req, res, next) => {
  if (req.path === '/api/database' && (req.method === 'POST' || req.method === 'PUT')) {
    return next(); // raw parser se aplica en la ruta
  }
  express.json({ limit: '1mb' })(req, res, next);
});

// Logger minimalista en dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - t0}ms)`);
    });
    next();
  });
}

/* ---------- Health check (público) ---------- */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'saludinfantil-server',
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
  });
});

/* ---------- Rutas API ---------- */
app.use('/api/auth', auth);
app.use('/api/database', database);

/* ---------- Manejo de errores ---------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;