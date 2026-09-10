import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import { createApp } from '../src/app';

describe('GovConnect Wallet Backend — Health Test Suite', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('GET /health returns 200 with service and status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200, 'HTTP status must be 200');

    const body = await res.json() as { service: string; status: string };
    assert.deepStrictEqual(body, {
      service: 'govconnect-wallet',
      status: 'ok'
    }, 'Response body must match required contract');
  });

  test('GET /unknown-endpoint returns 404', async () => {
    const res = await fetch(`${baseUrl}/non-existent`);
    assert.strictEqual(res.status, 404, 'Unknown endpoint must return 404');
    const body = await res.json() as { error: string };
    assert.ok(body.error, 'Error message must be present');
  });
});
