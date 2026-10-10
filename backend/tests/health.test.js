const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

// Minimal in-memory HTTP server tester helper without heavy supertest dependency
async function makeRequest(handler, options = {}) {
  const http = require('http');
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const url = `http://127.0.0.1:${port}${options.path || '/'}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /health returns health response payload', async () => {
  const res = await makeRequest(app, { path: '/health' });
  assert.ok([200, 503].includes(res.status), 'Health endpoint should return 200 or 503');
  assert.ok(res.body, 'Response body must exist');
  assert.ok(['healthy', 'degraded'].includes(res.body.status));
  assert.equal(res.body.services.backend, 'online');
});

test('GET /api/v1/health returns 200 OK with API version', async () => {
  const res = await makeRequest(app, { path: '/api/v1/health' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.version, 'v1');
});

test('GET /unknown-route returns 404 with standardized error format', async () => {
  const res = await makeRequest(app, { path: '/unknown-route-test-404' });
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
  assert.equal(res.body.error.code, 'RESOURCE_NOT_FOUND');
  assert.ok(res.body.error.message.includes('/unknown-route-test-404'));
});

test.after(async () => {
  const { closePool } = require('../src/config/db');
  await closePool();
});
