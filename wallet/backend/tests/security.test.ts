import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app';
import { config } from '../src/config';

describe('GovConnect Wallet Backend — Security & Configuration Test Suite', () => {
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

  test('REVENUE_API_KEY and SOCIAL_WELFARE_API_KEY are configured in backend config', () => {
    assert.ok(config.revenueApiKey, 'REVENUE_API_KEY must be loaded in backend config');
    assert.ok(config.socialWelfareApiKey, 'SOCIAL_WELFARE_API_KEY must be loaded in backend config');
    assert.strictEqual(typeof config.revenueApiKey, 'string');
    assert.strictEqual(typeof config.socialWelfareApiKey, 'string');
    assert.ok(config.revenueApiKey.length >= 8, 'REVENUE_API_KEY should be non-trivial');
    assert.ok(config.socialWelfareApiKey.length >= 8, 'SOCIAL_WELFARE_API_KEY should be non-trivial');
  });

  test('GET /health does NOT expose API keys or secrets in response payload', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    const bodyStr = JSON.stringify(body).toLowerCase();

    // Must strictly match safe health contract
    assert.deepStrictEqual(body, {
      service: 'govconnect-wallet',
      status: 'ok'
    });

    // Zero secret leakage
    assert.strictEqual(bodyStr.includes(config.revenueApiKey.toLowerCase()), false, 'Response must not contain Revenue API key');
    assert.strictEqual(bodyStr.includes(config.socialWelfareApiKey.toLowerCase()), false, 'Response must not contain Social Welfare API key');
    assert.strictEqual(bodyStr.includes('key'), false, 'Response must not contain key property');
    assert.strictEqual(bodyStr.includes('secret'), false, 'Response must not contain secret property');
  });

  test('Frontend configuration and environment do NOT expose issuer secrets', () => {
    // 1. Process environment inspection: No VITE_ variables contain issuer secrets
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('VITE_') && typeof value === 'string') {
        assert.ok(!value.includes(config.revenueApiKey), `VITE_ variable ${key} must not contain Revenue secret`);
        assert.ok(!value.includes(config.socialWelfareApiKey), `VITE_ variable ${key} must not contain Social Welfare secret`);
      }
    }

    // 2. Frontend .env file inspection: No issuer secret keys or URLs with secrets
    const frontendEnvPath = path.resolve(__dirname, '../../../frontend/.env');
    if (fs.existsSync(frontendEnvPath)) {
      const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
      assert.ok(!frontendEnv.includes('REVENUE_API_KEY'), 'Frontend .env must not contain REVENUE_API_KEY');
      assert.ok(!frontendEnv.includes('SOCIAL_WELFARE_API_KEY'), 'Frontend .env must not contain SOCIAL_WELFARE_API_KEY');
      assert.ok(!frontendEnv.includes(config.revenueApiKey), 'Frontend .env must not contain Revenue secret value');
      assert.ok(!frontendEnv.includes(config.socialWelfareApiKey), 'Frontend .env must not contain Social Welfare secret value');
    }
  });
});
