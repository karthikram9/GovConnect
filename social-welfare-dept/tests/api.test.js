const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const db = require('../src/db');
const { app } = require('../src/server');
const { verifyCredential, initKeys } = require('../src/crypto/signer');
const { generateToken } = require('../src/auth/token');

describe('Social Welfare Dept — API Test Suite', () => {
  let server;
  let baseUrl;
  let useMockDb = false;
  let socialWelfareOfficerToken;

  const mockCitizens = [
    {
      id: 1,
      applicant_name: 'Ramesh Kumar Patil',
      date_of_birth: '1988-04-12',
      caste_category: 'OBC',
      caste_name: 'Kunbi',
      certificate_number: 'MS-CC-2023-001089',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    },
    {
      id: 2,
      applicant_name: 'Sunita Devi Sharma',
      date_of_birth: '1979-11-03',
      caste_category: 'OBC',
      caste_name: 'Teli',
      certificate_number: 'MS-CC-2022-003421',
      address: '45, Gandhi Road, Nagpur, Maharashtra'
    },
    {
      id: 3,
      applicant_name: 'Ramesh K. Patil',
      date_of_birth: '1988-04-12',
      caste_category: 'OBC',
      caste_name: 'Kunbi',
      certificate_number: 'MS-CC-2023-001090',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    }
  ];

  const mockIssuedCredentials = [];
  const TEST_API_KEY = process.env.ISSUER_API_KEY || 'social-welfare-test-secret-key-2026';

  before(async () => {
    process.env.ISSUER_API_KEY = TEST_API_KEY;
    process.env.AUTH_TOKEN_SECRET = 'test-token-secret-for-social-welfare-testing-32bytes';
    socialWelfareOfficerToken = generateToken({ sub: 'swd_officer_01', role: 'ISSUER_OFFICER', dept: 'social-welfare' });
    initKeys();

    // Check if live PostgreSQL is connected
    const isConnected = await db.checkConnection();
    if (!isConnected) {
      console.log('Live PostgreSQL not connected for tests. Using fallback in-memory mock store.');
      useMockDb = true;

      db.setQueryHandler(async (sql, params = []) => {
        const queryStr = sql.toLowerCase();

        // SELECT citizens list
        if (queryStr.includes('select id, applicant_name')) {
          return {
            rows: mockCitizens.map(c => ({
              id: c.id,
              applicant_name: c.applicant_name,
              date_of_birth: c.date_of_birth
            }))
          };
        }

        // SELECT single citizen
        if (queryStr.includes('from citizens where id = $1')) {
          const id = params[0];
          const found = mockCitizens.find(c => c.id === id);
          return { rows: found ? [found] : [] };
        }

        // INSERT into issued_credentials
        if (queryStr.includes('insert into issued_credentials')) {
          const [citizen_id, credential_json, signature, issued_at] = params;
          const newRecord = {
            id: mockIssuedCredentials.length + 1,
            citizen_id,
            credential_json: typeof credential_json === 'string' ? JSON.parse(credential_json) : credential_json,
            signature,
            issued_at
          };
          mockIssuedCredentials.push(newRecord);
          return { rows: [newRecord] };
        }

        // SELECT from issued_credentials
        if (queryStr.includes('from issued_credentials')) {
          const rows = mockIssuedCredentials.map(ic => {
            const citizen = mockCitizens.find(c => c.id === ic.citizen_id);
            return {
              id: ic.id,
              citizen_id: ic.citizen_id,
              citizen_name: citizen ? citizen.applicant_name : `Citizen #${ic.citizen_id}`,
              credential_type: ic.credential_json.credentialType,
              issuer: ic.credential_json.issuer,
              signature: ic.signature,
              credential: ic.credential_json,
              issued_at: ic.issued_at
            };
          });
          return { rows };
        }

        return { rows: [] };
      });
    }

    // Start server on an ephemeral port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (useMockDb) {
      db.setQueryHandler(null);
    }
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await db.pool.end().catch(() => {});
  });

  test('7. GET /health returns 200 and status: ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { status: 'ok' });
  });

  test('8. GET /public-key returns issuer and public key, never private key', async () => {
    const res = await fetch(`${baseUrl}/public-key`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.strictEqual(body.issuer, 'social-welfare-dept-maharashtra');
    assert.ok(body.publicKey, 'Public key must be present');
    assert.strictEqual(body.privateKey, undefined, 'Private key must NOT be returned');
    assert.strictEqual(body.private_key, undefined, 'Private key must NOT be returned');
    assert.ok(!JSON.stringify(body).toLowerCase().includes('private'), 'Body must never contain private key');
  });

  test('9a. GET /citizens requires authentication (401 without token)', async () => {
    const res = await fetch(`${baseUrl}/citizens`);
    assert.strictEqual(res.status, 401);
  });

  test('9b. GET /citizens returns seeded citizens with only minimal fields when authenticated', async () => {
    const res = await fetch(`${baseUrl}/citizens`, {
      headers: {
        'Authorization': `Bearer ${socialWelfareOfficerToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const citizens = await res.json();

    assert.ok(Array.isArray(citizens), 'Should return an array');
    assert.ok(citizens.length >= 3, 'Should return citizens list');

    const first = citizens[0];
    assert.ok('id' in first, 'id should be present');
    assert.ok('applicant_name' in first, 'applicant_name should be present');
    assert.ok('date_of_birth' in first, 'date_of_birth should be present');

    // Strict Security Requirement: Do NOT expose caste details through this picker endpoint
    assert.strictEqual(first.caste_category, undefined, 'caste_category must NOT be exposed');
    assert.strictEqual(first.casteCategory, undefined, 'casteCategory must NOT be exposed');
    assert.strictEqual(first.caste_name, undefined, 'caste_name must NOT be exposed');
    assert.strictEqual(first.casteName, undefined, 'casteName must NOT be exposed');
    assert.strictEqual(first.certificate_number, undefined, 'certificate_number must NOT be exposed');
    assert.strictEqual(first.certificateNumber, undefined, 'certificateNumber must NOT be exposed');
  });

  test('10a. GET /citizens/:citizenId requires authentication (401 without token)', async () => {
    const res = await fetch(`${baseUrl}/citizens/1`);
    assert.strictEqual(res.status, 401);
  });

  test('10b. GET /citizens/:citizenId returns staff-level record with caste details when authenticated', async () => {
    const res = await fetch(`${baseUrl}/citizens/1`, {
      headers: {
        'Authorization': `Bearer ${socialWelfareOfficerToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const citizen = await res.json();

    assert.strictEqual(citizen.id, 1);
    assert.strictEqual(citizen.applicant_name, 'Ramesh Kumar Patil');
    assert.strictEqual(citizen.caste_category, 'OBC');
    assert.strictEqual(citizen.caste_name, 'Kunbi');
    assert.strictEqual(citizen.certificate_number, 'MS-CC-2023-001089');
    assert.ok(citizen.address.includes('Pune'));
  });

  test('10a. POST /issue-credential/:citizenId without X-API-Key returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, { method: 'POST' });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.deepStrictEqual(body, { error: 'Unauthorized' });
  });

  test('10b. POST /issue-credential/:citizenId with invalid X-API-Key returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'X-API-Key': 'invalid-secret-key-123' }
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.deepStrictEqual(body, { error: 'Unauthorized' });
  });

  test('10c. Unauthorized issuance does NOT create a database record', async () => {
    const countResBefore = await db.query('SELECT * FROM issued_credentials');
    const recordsBefore = countResBefore.rows.length;

    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'X-API-Key': 'unauthorized-test-token' }
    });
    assert.strictEqual(res.status, 401);

    const countResAfter = await db.query('SELECT * FROM issued_credentials');
    const recordsAfter = countResAfter.rows.length;
    assert.strictEqual(recordsAfter, recordsBefore, 'Database record count must not change on unauthorized request');
  });

  test('11. POST /issue-credential/:citizenId issues valid Ed25519 signed CasteCertificate with valid X-API-Key', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();

    assert.ok(body.credential, 'Credential object must be present');
    assert.ok(body.signature, 'Base64 signature must be present');
    assert.strictEqual(body.issuer, 'social-welfare-dept-maharashtra');

    const cred = body.credential;
    assert.strictEqual(cred.credentialType, 'CasteCertificate');
    assert.strictEqual(cred.issuer, 'social-welfare-dept-maharashtra');
    assert.strictEqual(cred.subject.name, 'Ramesh Kumar Patil');
    assert.strictEqual(cred.subject.dateOfBirth, '1988-04-12');
    assert.strictEqual(cred.subject.address, '12, Shivaji Nagar, Pune, Maharashtra');
    assert.strictEqual(cred.claims.casteCategory, 'OBC');
    assert.strictEqual(cred.claims.casteName, 'Kunbi');
    assert.strictEqual(cred.claims.certificateNumber, 'MS-CC-2023-001089');
    assert.ok(new Date(cred.issuedAt).getTime() > 0, 'issuedAt must be valid ISO timestamp');

    // Cryptographic verification of returned signature
    const isValid = verifyCredential(cred, body.signature);
    assert.strictEqual(isValid, true, 'Returned signature must verify with public key');
  });

  test('12. POST /issue-credential/:citizenId with non-existent ID returns 404', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/999999`, {
      method: 'POST',
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.ok(body.error, 'Error message must be present');
  });

  test('13. POST /issue-credential/:citizenId with invalid ID returns 400', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/invalid-id`, {
      method: 'POST',
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, 'Error message must be present');
  });

  test('14a. GET /issued-credentials requires authentication (401 without token)', async () => {
    const res = await fetch(`${baseUrl}/issued-credentials`);
    assert.strictEqual(res.status, 401);
  });

  test('14b. GET /issued-credentials returns issued credentials list when authenticated', async () => {
    const res = await fetch(`${baseUrl}/issued-credentials`, {
      headers: {
        'Authorization': `Bearer ${socialWelfareOfficerToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const list = await res.json();

    assert.ok(Array.isArray(list), 'Should return an array');
    assert.ok(list.length >= 1, 'Should contain at least the issued credential');

    const last = list[0];
    assert.ok(last.id, 'Credential ID should exist');
    assert.ok(last.signature, 'Signature should exist');
    assert.ok(last.credential, 'Credential JSON should exist');
    assert.strictEqual(last.issuer, 'social-welfare-dept-maharashtra');
    assert.strictEqual(last.credential_type, 'CasteCertificate');
  });

  test('15. POST /issue-credential/:citizenId succeeds with human Bearer token (dual-mode)', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${socialWelfareOfficerToken}`
      }
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.credential);
    assert.strictEqual(body.credential.subject.name, 'Sunita Devi Sharma');
  });
});
