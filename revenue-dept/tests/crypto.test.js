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
const { buildCredential } = require('../src/credentials/incomeCertificate');

describe('Cryptographic Signature & Determinism Test Suite', () => {
  let mockCitizen;

  before(() => {
    initKeys();
    mockCitizen = {
      id: 1,
      applicant_name: 'Ramesh Kumar Patil',
      date_of_birth: '1988-04-12',
      annual_income: 312000,
      pan_number: 'ABCDE1234F',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    };
  });

  test('Persistent Key Pair Exists and Survives Restarts', () => {
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

  test('Canonicalization is Deterministic Regardless of Key Ordering', () => {
    const objA = {
      b: 2,
      a: 1,
      nested: { z: 26, y: 25 }
    };
    const objB = {
      nested: { y: 25, z: 26 },
      a: 1,
      b: 2
    };

    const canonA = canonicalize(objA);
    const canonB = canonicalize(objB);

    assert.strictEqual(canonA, canonB, 'Canonical serialization must match regardless of property order');
    assert.strictEqual(canonA, '{"a":1,"b":2,"nested":{"y":25,"z":26}}');
  });

  test('Signature Determinism: Same Credential + Same Key = Identical Signature', () => {
    const fixedTimestamp = '2026-01-01T00:00:00.000Z';
    const credential1 = buildCredential(mockCitizen, fixedTimestamp);
    const credential2 = buildCredential(mockCitizen, fixedTimestamp);

    // Assert inputs are structurally identical
    assert.deepStrictEqual(credential1, credential2);

    const sig1 = signCredential(credential1);
    const sig2 = signCredential(credential2);

    assert.ok(typeof sig1 === 'string' && sig1.length > 0, 'Signature 1 should be a non-empty string');
    assert.strictEqual(sig1, sig2, 'Mandatory: Signing identical credential data twice must produce identical Base64 signature');
  });

  test('Cryptographic Acceptance: Valid Credential Verifies Successfully', () => {
    const credential = buildCredential(mockCitizen, '2026-03-01T12:00:00.000Z');
    const signature = signCredential(credential);

    // Verify using internal public key
    const isValid = verifyCredential(credential, signature);
    assert.strictEqual(isValid, true, 'Original unmodified credential must verify as valid');

    // Verify using exported base64 public key
    const pubKeyBase64 = getPublicKeyBase64();
    const isValidBase64 = verifyCredential(credential, signature, pubKeyBase64);
    assert.strictEqual(isValidBase64, true, 'Credential must verify using exported Base64 public key');
  });

  test('Cryptographic Tamper-Evidence: Modifying Claims Invalidates Signature', () => {
    const credential = buildCredential(mockCitizen, '2026-03-01T12:00:00.000Z');
    const signature = signCredential(credential);

    // Tamper with annualIncome: change from 312000 to 999999
    const tamperedCredential = JSON.parse(JSON.stringify(credential));
    tamperedCredential.claims.annualIncome = 999999;

    const isValid = verifyCredential(tamperedCredential, signature);
    assert.strictEqual(isValid, false, 'Tampered annualIncome must cause signature verification to FAIL');

    // Tamper with subject name
    const tamperedName = JSON.parse(JSON.stringify(credential));
    tamperedName.subject.name = 'Imposter Patil';
    assert.strictEqual(verifyCredential(tamperedName, signature), false, 'Tampered name must fail verification');

    // Tamper with issuer
    const tamperedIssuer = JSON.parse(JSON.stringify(credential));
    tamperedIssuer.issuer = 'fake-revenue-dept';
    assert.strictEqual(verifyCredential(tamperedIssuer, signature), false, 'Tampered issuer must fail verification');
  });
});
