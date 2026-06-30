/* ============================================================
   test/e2e.js — Test end-to-end del backend
   - Levanta el server en un puerto random
   - Hace health check, register, login, push, pull, head
   - Verifica conflict resolution (412 con If-Match incorrecto)
   - Cierra el server
   Ejecutar: node test/e2e.js
   ============================================================ */
'use strict';

const http = require('http');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // random port
process.env.JWT_SECRET = 'test-secret-' + crypto.randomBytes(32).toString('hex');
process.env.DB_PATH = ':memory:'; // DB en RAM

const app = require('../src/app');

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[test] Server up en ${baseUrl}`);
      resolve();
    });
    server.on('error', reject);
  });
}

function stopServer() {
  return new Promise(resolve => server.close(resolve));
}

function request(method, path, { body, headers = {}, raw = false, accessToken = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };
    if (accessToken) opts.headers['Authorization'] = 'Bearer ' + accessToken;

    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json, text });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const assert = (cond, msg) => {
  if (!cond) {
    console.error('❌ ASSERT FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  } else {
    console.log('  ✓', msg);
  }
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTests() {
  console.log('\n=== 1. Health check ===');
  const h = await request('GET', '/api/health');
  assert(h.status === 200, 'health responde 200');
  assert(h.json.ok === true, 'health.ok === true');
  assert(h.json.service === 'saludinfantil-server', 'service correcto');

  console.log('\n=== 2. Register ===');
  const username = 'testuser_' + Date.now();
  const password = 'supersecret123';
  const r = await request('POST', '/api/auth/register', {
    body: JSON.stringify({ username, displayName: 'Test User', password }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(r.status === 201, 'register devuelve 201');
  assert(r.json.accessToken, 'register devuelve accessToken');
  assert(r.json.refreshToken, 'register devuelve refreshToken');
  assert(r.json.user.username === username, 'username correcto');
  const accessToken = r.json.accessToken;
  const refreshToken = r.json.refreshToken;

  console.log('\n=== 3. Login duplicado falla ===');
  const dup = await request('POST', '/api/auth/login', {
    body: JSON.stringify({ username, password: 'wrongpass' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(dup.status === 401, 'login con password mal → 401');

  console.log('\n=== 4. Login OK ===');
  const li = await request('POST', '/api/auth/login', {
    body: JSON.stringify({ username, password }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(li.status === 200, 'login devuelve 200');
  assert(li.json.accessToken, 'login devuelve accessToken');

  console.log('\n=== 5. Me ===');
  const me = await request('GET', '/api/auth/me', { accessToken });
  assert(me.status === 200, 'me → 200');
  assert(me.json.user.username === username, 'me devuelve usuario correcto');

  console.log('\n=== 6. HEAD database (sin blob) ===');
  const head1 = await request('HEAD', '/api/database', { accessToken });
  assert(head1.status === 404, 'HEAD sin blob → 404');

  console.log('\n=== 7. GET database (sin blob) ===');
  const get1 = await request('GET', '/api/database', { accessToken });
  assert(get1.status === 404, 'GET sin blob → 404');

  console.log('\n=== 8. PUT database (subir blob cifrado) ===');
  // Simular blob cifrado (marker ENC1 + 16 bytes salt + 12 bytes iv + ciphertext)
  const fakeEncryptedBlob = Buffer.concat([
    Buffer.from('ENC1', 'ascii'),
    crypto.randomBytes(16), // salt
    crypto.randomBytes(12), // iv
    crypto.randomBytes(256), // ciphertext + tag
  ]);
  const put1 = await request('PUT', '/api/database', {
    body: fakeEncryptedBlob,
    headers: { 'Content-Type': 'application/octet-stream' },
    accessToken,
  });
  assert(put1.status === 200, 'PUT primer blob → 200');
  assert(put1.json.etag && put1.json.etag.length === 64, 'etag es sha256 hex (64 chars)');
  assert(put1.json.version === 1, 'version === 1 después de primer PUT');
  const etag1 = put1.json.etag;

  console.log('\n=== 9. HEAD database (con blob) ===');
  const head2 = await request('HEAD', '/api/database', { accessToken });
  assert(head2.status === 200, 'HEAD con blob → 200');
  assert(head2.headers.etag === `"${etag1}"`, 'etag coincide');

  console.log('\n=== 10. GET database (con blob) ===');
  const get2 = await request('GET', '/api/database', { accessToken });
  assert(get2.status === 200, 'GET con blob → 200');
  assert(Buffer.compare(get2.body, fakeEncryptedBlob) === 0, 'blob descargado idéntico al subido');

  console.log('\n=== 11. PUT con If-Match incorrecto (conflict) ===');
  const fakeBlob2 = Buffer.concat([
    Buffer.from('ENC1', 'ascii'),
    crypto.randomBytes(16),
    crypto.randomBytes(12),
    crypto.randomBytes(128),
  ]);
  const conflict = await request('PUT', '/api/database', {
    body: fakeBlob2,
    headers: {
      'Content-Type': 'application/octet-stream',
      'If-Match': '"etag-falso-123"',
    },
    accessToken,
  });
  assert(conflict.status === 412, 'If-Match incorrecto → 412');
  assert(conflict.json.code === 'PRECONDITION_FAILED', 'code === PRECONDITION_FAILED');
  assert(conflict.json.currentEtag === etag1, 'currentEtag devuelto');

  console.log('\n=== 12. PUT con If-Match correcto ===');
  const fakeBlob3 = Buffer.concat([
    Buffer.from('ENC1', 'ascii'),
    crypto.randomBytes(16),
    crypto.randomBytes(12),
    crypto.randomBytes(192),
  ]);
  const put2 = await request('PUT', '/api/database', {
    body: fakeBlob3,
    headers: {
      'Content-Type': 'application/octet-stream',
      'If-Match': `"${etag1}"`,
    },
    accessToken,
  });
  assert(put2.status === 200, 'PUT con If-Match correcto → 200');
  assert(put2.json.version === 2, 'version === 2 después de segundo PUT');

  console.log('\n=== 13. PUT sin marker ENC1 (validación) ===');
  const invalidBlob = crypto.randomBytes(100); // sin "ENC1"
  const bad = await request('PUT', '/api/database', {
    body: invalidBlob,
    headers: { 'Content-Type': 'application/octet-stream' },
    accessToken,
  });
  assert(bad.status === 400, 'PUT sin marker → 400');
  assert(bad.json.code === 'INVALID_MARKER', 'code === INVALID_MARKER');

  console.log('\n=== 14. Refresh token ===');
  const refresh = await request('POST', '/api/auth/refresh', {
    body: JSON.stringify({ refreshToken }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(refresh.status === 200, 'refresh → 200');
  assert(refresh.json.accessToken, 'refresh devuelve nuevo accessToken');

  console.log('\n=== 15. Auth requerida ===');
  const noAuth = await request('GET', '/api/database');
  assert(noAuth.status === 401, 'GET sin token → 401');

  console.log('\n=== 16. Token inválido ===');
  const badToken = await request('GET', '/api/database', { accessToken: 'invalid.token.here' });
  assert(badToken.status === 401, 'GET con token inválido → 401');

  console.log('\n=== 17. DELETE database ===');
  const del = await request('DELETE', '/api/database', { accessToken });
  assert(del.status === 200, 'DELETE → 200');
  assert(del.json.deleted === true, 'deleted === true');

  const head3 = await request('HEAD', '/api/database', { accessToken });
  assert(head3.status === 404, 'HEAD post-DELETE → 404');

  console.log('\n=== 18. Registro con datos inválidos ===');
  const badReg1 = await request('POST', '/api/auth/register', {
    body: JSON.stringify({ username: 'ab', displayName: 'X', password: '1234' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(badReg1.status === 400, 'username corto → 400');

  const badReg2 = await request('POST', '/api/auth/register', {
    body: JSON.stringify({ username: 'validuser', displayName: 'X', password: '123' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert(badReg2.status === 400, 'password corto → 400');

  console.log('\n✅ Todos los tests pasaron!');
}

(async () => {
  try {
    await startServer();
    await runTests();
  } catch (e) {
    console.error('❌ Test falló:', e.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
    process.exit(process.exitCode || 0);
  }
})();