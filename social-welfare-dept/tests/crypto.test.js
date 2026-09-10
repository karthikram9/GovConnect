const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  initKeys,
  canonicalize,
  signCredential,
  verifyCredential,
  getPublicKeyBase64,
  getPublicKeyPem
} = require('../src/crypto/signer');
const { buildCredential } = require('../src/credentials/casteCertificate');

describe('Social Welfare Dept — Cryptographic Signature & Determinism Test Suite', () => {
  let mockCitizen;

  before(() => {
    initKeys();
    mockCitizen = {
      id: 1,
      applicant_name: 'Ramesh Kumar Patil',
      date_of_birth: '1988-04-12',
      caste_category: 'OBC',
      caste_name: 'Kunbi',
      certificate_number: 'MS-CC-2023-001089',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    };
  });

  test('1. Ed25519 Key Generation and File Persistence', () => {
    const keysDir = path.resolve(__dirname, '../keys');
    const privateKeyPath = path.join(keysDir, 'private_key.pem');
    const publicKeyPath = path.join(keysDir, 'public_key.pem');

    assert.ok(fs.existsSync(privateKeyPath), 'private_key.pem should exist');
    assert.ok(fs.existsSync(publicKeyPath), 'public_key.pem should exist');

    const pubKeyBase64 = getPublicKeyBase64();
    assert.ok(typeof pubKeyBase64 === 'string' && pubKeyBase64.length > 20, 'Public key Base64 should be valid');

    const pubKeyPem = getPublicKeyPem();
    assert.ok(pubKeyPem.includes('-----BEGIN PUBLIC KEY-----'), 'Public key PEM should have valid header');
    assert.ok(!pubKeyPem.includes('PRIVATE KEY'), 'Public key must NEVER contain private key');
  });

  test('2. Key Persistence: Re-invoking initKeys retains existing keypair', () => {
    const key1 = getPublicKeyBase64();
    const loaded = initKeys();
    assert.strictEqual(loaded.publicKeyBase64, key1, 'Re-initialization must load existing key, not generate new one');
  });

  test('3. Credential Canonicalization is Deterministic Regardless of Property Order', () => {
    const objA = {
      claims: { certificateNumber: 'MS-123', casteName: 'Kunbi', casteCategory: 'OBC' },
      issuer: 'social-welfare-dept-maharashtra',
      credentialType: 'CasteCertificate'
    };
    const objB = {
      credentialType: 'CasteCertificate',
      issuer: 'social-welfare-dept-maharashtra',
      claims: { casteCategory: 'OBC', casteName: 'Kunbi', certificateNumber: 'MS-123' }
    };

    const canonA = canonicalize(objA);
    const canonB = canonicalize(objB);

    assert.strictEqual(canonA, canonB, 'Canonical serialization must match regardless of property order');
    assert.strictEqual(
      canonA,
      '{"claims":{"casteCategory":"OBC","casteName":"Kunbi","certificateNumber":"MS-123"},"credentialType":"CasteCertificate","issuer":"social-welfare-dept-maharashtra"}'
    );
  });

  test('4. Signature Determinism: Same Credential + Same Key = Identical Base64 Signature', () => {
    const fixedTimestamp = '2026-01-01T00:00:00.000Z';
    const credential1 = buildCredential(mockCitizen, fixedTimestamp);
    const credential2 = buildCredential(mockCitizen, fixedTimestamp);

    assert.deepStrictEqual(credential1, credential2);

    const sig1 = signCredential(credential1);
    const sig2 = signCredential(credential2);

    assert.ok(typeof sig1 === 'string' && sig1.length > 0, 'Signature should be non-empty string');
    assert.strictEqual(sig1, sig2, 'Signing identical credential data twice must produce identical Base64 signature');
  });

  test('5. Cryptographic Acceptance: Valid Credential Verifies Successfully', () => {
    const credential = buildCredential(mockCitizen, '2026-03-01T12:00:00.000Z');
    const signature = signCredential(credential);

    // Verify using internal key
    const isValid = verifyCredential(credential, signature);
    assert.strictEqual(isValid, true, 'Original unmodified credential must verify as valid');

    // Verify using exported Base64 SPKI public key
    const pubKeyBase64 = getPublicKeyBase64();
    const isValidBase64 = verifyCredential(credential, signature, pubKeyBase64);
    assert.strictEqual(isValidBase64, true, 'Credential must verify using exported Base64 SPKI public key');

    // Verify using PEM public key
    const pubKeyPem = getPublicKeyPem();
    const isValidPem = verifyCredential(credential, signature, pubKeyPem);
    assert.strictEqual(isValidPem, true, 'Credential must verify using exported PEM public key');
  });

  test('6. Cryptographic Tamper-Evidence: Modifying Any Claim/Subject/Issuer Invalidates Signature', () => {
    const credential = buildCredential(mockCitizen, '2026-03-01T12:00:00.000Z');
    const signature = signCredential(credential);

    // Tamper with casteCategory: OBC -> SC
    const tamperedCat = JSON.parse(JSON.stringify(credential));
    tamperedCat.claims.casteCategory = 'SC';
    assert.strictEqual(verifyCredential(tamperedCat, signature), false, 'Tampered casteCategory must fail verification');

    // Tamper with casteName
    const tamperedCaste = JSON.parse(JSON.stringify(credential));
    tamperedCaste.claims.casteName = 'FakeCaste';
    assert.strictEqual(verifyCredential(tamperedCaste, signature), false, 'Tampered casteName must fail verification');

    // Tamper with certificateNumber
    const tamperedCert = JSON.parse(JSON.stringify(credential));
    tamperedCert.claims.certificateNumber = 'MS-CC-FAKE-999999';
    assert.strictEqual(verifyCredential(tamperedCert, signature), false, 'Tampered certificateNumber must fail verification');

    // Tamper with subject name
    const tamperedName = JSON.parse(JSON.stringify(credential));
    tamperedName.subject.name = 'Imposter Patil';
    assert.strictEqual(verifyCredential(tamperedName, signature), false, 'Tampered subject name must fail verification');

    // Tamper with issuer
    const tamperedIssuer = JSON.parse(JSON.stringify(credential));
    tamperedIssuer.issuer = 'fraudulent-dept';
    assert.strictEqual(verifyCredential(tamperedIssuer, signature), false, 'Tampered issuer must fail verification');
  });
});
