import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';
import { createApp } from '../src/app';
import { config } from '../src/config';

describe('GovConnect Wallet Backend — Credential Fetch & Verification Test Suite', () => {
  let walletServer: Server;
  let walletBaseUrl: string;

  let mockRevenueServer: Server;
  let mockRevenueBaseUrl: string;

  let mockSocialWelfareServer: Server;
  let mockSocialWelfareBaseUrl: string;

  let revenueKeyPair: crypto.KeyPairSyncResult<string, string>;
  let swKeyPair: crypto.KeyPairSyncResult<string, string>;

  const originalRevenueUrl = config.revenueApiUrl;
  const originalSocialWelfareUrl = config.socialWelfareApiUrl;
  const originalRevenueKey = config.revenueApiKey;
  const originalSocialWelfareKey = config.socialWelfareApiKey;

  before(async () => {
    // Generate test Ed25519 keypairs for mock issuers
    revenueKeyPair = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    swKeyPair = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // 1. Mock Revenue Server
    mockRevenueServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const apiKey = req.headers['x-api-key'];

      // Public key endpoint
      if (req.method === 'GET' && url.pathname === '/public-key') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          issuer: 'revenue-dept-maharashtra',
          publicKeyPem: revenueKeyPair.publicKey
        }));
      }

      // Check API Key
      if (apiKey !== 'test-revenue-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      // 404 test route
      if (url.pathname === '/issue-credential/999') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Citizen not found' }));
      }

      // Malformed response test route
      if (url.pathname === '/issue-credential/888') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ malformed: true }));
      }

      // Issue Income Certificate
      if (req.method === 'POST' && url.pathname.startsWith('/issue-credential/')) {
        const credential = {
          credentialType: 'IncomeCertificate',
          issuer: 'revenue-dept-maharashtra',
          subject: {
            name: 'Ramesh Kumar Patil',
            dateOfBirth: '1988-04-12',
            panNumber: 'ABCDE1234F',
            address: '12, Shivaji Nagar, Pune, Maharashtra'
          },
          claims: {
            annualIncome: 312000
          },
          issuedAt: '2026-09-09T10:00:00.000Z'
        };

        const canonical = stringify(credential);
        const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), revenueKeyPair.privateKey).toString('base64');

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          credential,
          signature,
          issuer: 'revenue-dept-maharashtra'
        }));
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>(res => mockRevenueServer.listen(0, res));
    const revPort = (mockRevenueServer.address() as { port: number }).port;
    mockRevenueBaseUrl = `http://localhost:${revPort}`;

    // 2. Mock Social Welfare Server
    mockSocialWelfareServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const apiKey = req.headers['x-api-key'];

      // Public key endpoint
      if (req.method === 'GET' && url.pathname === '/public-key') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          issuer: 'social-welfare-dept-maharashtra',
          publicKeyPem: swKeyPair.publicKey
        }));
      }

      // Check API Key
      if (apiKey !== 'test-sw-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      // Issue Caste Certificate
      if (req.method === 'POST' && url.pathname.startsWith('/issue-credential/')) {
        const credential = {
          credentialType: 'CasteCertificate',
          issuer: 'social-welfare-dept-maharashtra',
          subject: {
            name: 'Ramesh Kumar Patil',
            dateOfBirth: '1988-04-12',
            address: '12, Shivaji Nagar, Pune, Maharashtra'
          },
          claims: {
            casteCategory: 'OBC',
            casteName: 'Kunbi',
            certificateNumber: 'MS-CC-2023-001089'
          },
          issuedAt: '2026-09-09T10:00:00.000Z'
        };

        const canonical = stringify(credential);
        const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), swKeyPair.privateKey).toString('base64');

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          credential,
          signature,
          issuer: 'social-welfare-dept-maharashtra'
        }));
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>(res => mockSocialWelfareServer.listen(0, res));
    const swPort = (mockSocialWelfareServer.address() as { port: number }).port;
    mockSocialWelfareBaseUrl = `http://localhost:${swPort}`;

    // Configure Wallet to point to mock issuers
    config.revenueApiUrl = mockRevenueBaseUrl;
    config.socialWelfareApiUrl = mockSocialWelfareBaseUrl;
    config.revenueApiKey = 'test-revenue-key';
    config.socialWelfareApiKey = 'test-sw-key';

    // 3. Start Wallet Backend Server
    const app = createApp();
    walletServer = http.createServer(app);
    await new Promise<void>(res => walletServer.listen(0, res));
    const walletPort = (walletServer.address() as { port: number }).port;
    walletBaseUrl = `http://localhost:${walletPort}`;
  });

  after(async () => {
    // Restore config
    config.revenueApiUrl = originalRevenueUrl;
    config.socialWelfareApiUrl = originalSocialWelfareUrl;
    config.revenueApiKey = originalRevenueKey;
    config.socialWelfareApiKey = originalSocialWelfareKey;

    if (walletServer) await new Promise<void>(res => walletServer.close(() => res()));
    if (mockRevenueServer) await new Promise<void>(res => mockRevenueServer.close(() => res()));
    if (mockSocialWelfareServer) await new Promise<void>(res => mockSocialWelfareServer.close(() => res()));
  });

  test('GET /api/credentials confirms edge-held storage architecture', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { storageModel: string; credentials: unknown[] };
    assert.strictEqual(body.storageModel, 'edge-held-indexeddb');
    assert.deepStrictEqual(body.credentials, []);
  });

  test('POST /api/credentials/fetch/income succeeds and verifies Ed25519 signature', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 1 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as Record<string, any>;

    assert.strictEqual(body.credentialType, 'IncomeCertificate');
    assert.strictEqual(body.issuer, 'revenue-dept-maharashtra');
    assert.strictEqual(body.verification.status, 'verified');
    assert.strictEqual(body.verification.algorithm, 'Ed25519');
    assert.strictEqual(body.originalCredential.claims.annualIncome, 312000);
    assert.ok(body.signature);

    // Cryptographically verify returned signature against public key
    const canonical = stringify(body.originalCredential);
    const isValid = crypto.verify(
      null,
      Buffer.from(canonical, 'utf8'),
      crypto.createPublicKey(revenueKeyPair.publicKey),
      Buffer.from(body.signature, 'base64')
    );
    assert.strictEqual(isValid, true, 'Returned signature must verify with public key');
  });

  test('POST /api/credentials/fetch/caste succeeds and verifies Ed25519 signature', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/caste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 1 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as Record<string, any>;

    assert.strictEqual(body.credentialType, 'CasteCertificate');
    assert.strictEqual(body.issuer, 'social-welfare-dept-maharashtra');
    assert.strictEqual(body.verification.status, 'verified');
    assert.strictEqual(body.verification.algorithm, 'Ed25519');
    assert.strictEqual(body.originalCredential.claims.casteCategory, 'OBC');
    assert.strictEqual(body.originalCredential.claims.casteName, 'Kunbi');
    assert.ok(body.signature);

    // Cryptographically verify returned signature against public key
    const canonical = stringify(body.originalCredential);
    const isValid = crypto.verify(
      null,
      Buffer.from(canonical, 'utf8'),
      crypto.createPublicKey(swKeyPair.publicKey),
      Buffer.from(body.signature, 'base64')
    );
    assert.strictEqual(isValid, true, 'Returned signature must verify with public key');
  });

  test('POST /api/credentials/fetch/income rejects invalid/tampered signature with HTTP 502', async () => {
    // Temporarily swap Revenue key pair so signature is signed by a different key
    const bogusKeyPair = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });

    // Create a temporary server with bogus signature
    const badServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/public-key') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // Genuine public key returned
        return res.end(JSON.stringify({
          issuer: 'revenue-dept-maharashtra',
          publicKeyPem: revenueKeyPair.publicKey
        }));
      }
      if (url.pathname.startsWith('/issue-credential/')) {
        const credential = {
          credentialType: 'IncomeCertificate',
          claims: { annualIncome: 999999 }
        };
        // Signed with UNTRUSTED/BOGUS key
        const bogusSig = crypto.sign(null, Buffer.from(stringify(credential), 'utf8'), bogusKeyPair.privateKey).toString('base64');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          credential,
          signature: bogusSig,
          issuer: 'revenue-dept-maharashtra'
        }));
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>(res => badServer.listen(0, res));
    const badPort = (badServer.address() as { port: number }).port;

    config.revenueApiUrl = `http://localhost:${badPort}`;

    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 1 })
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, 'CREDENTIAL_SIGNATURE_INVALID');

    await new Promise<void>(res => badServer.close(() => res()));
    config.revenueApiUrl = mockRevenueBaseUrl;
  });

  test('POST /api/credentials/fetch/income handles issuer 401 cleanly', async () => {
    config.revenueApiKey = 'wrong-key';

    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 1 })
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json() as { error: string; message: string };
    assert.strictEqual(body.error, 'ISSUER_UNAUTHORIZED');

    config.revenueApiKey = 'test-revenue-key';
  });

  test('POST /api/credentials/fetch/income handles issuer 404 cleanly', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 999 })
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, 'CITIZEN_NOT_FOUND');
  });

  test('POST /api/credentials/fetch/income rejects malformed issuer response', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 888 })
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, 'ISSUER_MALFORMED_RESPONSE');
  });

  test('POST responses NEVER expose issuer API keys or internal secrets', async () => {
    const res = await fetch(`${walletBaseUrl}/api/credentials/fetch/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId: 1 })
    });

    const bodyStr = await res.text();
    assert.strictEqual(bodyStr.includes('test-revenue-key'), false, 'Response must not contain Revenue API key');
    assert.strictEqual(bodyStr.includes('test-sw-key'), false, 'Response must not contain Social Welfare API key');
  });
});
