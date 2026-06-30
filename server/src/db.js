/* ============================================================
   db.js — inicialización de SQLite (better-sqlite3)
   - Tabla users: cuentas locales con bcrypt hash + salt
   - Tabla databases: blob cifrado por user con etag + timestamp
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let _db = null;

function getDbPath() {
  const envPath = process.env.DB_PATH || './data/server.sqlite';
  if (envPath === ':memory:') return ':memory:';
  return path.resolve(envPath);
}

function initDb() {
  if (_db) return _db;

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');     // concurrencia reader/writer
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');   // un poco más rápido, WAL ya protege

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,        -- bcrypt del password server-side
      encryptionSalt TEXT,                -- salt distinto para cifrado de DB (hex)
      role TEXT NOT NULL DEFAULT 'admin',
      createdAt TEXT NOT NULL,
      lastLogin TEXT
    );

    CREATE TABLE IF NOT EXISTS databases (
      userId TEXT PRIMARY KEY,
      blob BLOB NOT NULL,                 -- bytes cifrados (opaco al server)
      etag TEXT NOT NULL,                 -- hash del blob (sha256 hex)
      size INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_databases_updated ON databases(updatedAt);
  `);

  console.log(`[db] SQLite inicializado en ${dbPath}`);
  return _db;
}

function getDb() {
  if (!_db) initDb();
  return _db;
}

module.exports = { initDb, getDb };