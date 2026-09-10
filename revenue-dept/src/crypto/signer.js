const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stringify = require('fast-json-stable-stringify');

const KEYS_DIR = path.resolve(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public_key.pem');

let privateKeyObject = null;
let publicKeyObject = null;
let publicKeyBase64 = null;
let publicKeyPem = null;

/**
 * Initializes or loads the Ed25519 key pair from keys/ directory.
 * Ensures the key pair survives server restarts.
 */
function initKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const hasPrivate = fs.existsSync(PRIVATE_KEY_PATH);
  const hasPublic = fs.existsSync(PUBLIC_KEY_PATH);

  if (hasPrivate && hasPublic) {
    // Load existing keys
    const privatePem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

    privateKeyObject = crypto.createPrivateKey(privatePem);
    publicKeyObject = crypto.createPublicKey(publicPem);
    publicKeyPem = publicPem;
    publicKeyBase64 = publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');
  } else {
    // Generate new Ed25519 keypair
    const keyPair = crypto.generateKeyPairSync('ed25519');
    privateKeyObject = keyPair.privateKey;
    publicKeyObject = keyPair.publicKey;

    const privatePem = privateKeyObject.export({ type: 'pkcs8', format: 'pem' });
    const publicPem = publicKeyObject.export({ type: 'spki', format: 'pem' });

    fs.writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicPem, { mode: 0o644 });

    publicKeyPem = publicPem;
    publicKeyBase64 = publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');
  }

  return {
    publicKeyBase64,
    publicKeyPem
  };
}

/**
 * Canonically serializes a credential object into deterministic UTF-8 JSON.
 * Produces identical string representation regardless of key insertion order.
 */
function canonicalize(data) {
  return stringify(data);
}

/**
 * Signs a credential object using Ed25519 private key.
 * @param {object} credentialObject
 * @returns {string} Base64-encoded signature
 */
function signCredential(credentialObject) {
  if (!privateKeyObject) {
    initKeys();
  }
  const canonicalData = canonicalize(credentialObject);
  const signatureBuffer = crypto.sign(null, Buffer.from(canonicalData, 'utf8'), privateKeyObject);
  return signatureBuffer.toString('base64');
}

/**
 * Verifies a credential object against an Ed25519 Base64 signature.
 * @param {object} credentialObject
 * @param {string} signatureBase64
 * @param {crypto.KeyObject|string|Buffer} [key] Optional public key (defaults to current public key)
 * @returns {boolean} true if valid, false otherwise
 */
function verifyCredential(credentialObject, signatureBase64, key) {
  let verifierKey = key;
  if (!verifierKey) {
    if (!publicKeyObject) {
      initKeys();
    }
    verifierKey = publicKeyObject;
  } else if (typeof verifierKey === 'string') {
    if (verifierKey.includes('-----BEGIN PUBLIC KEY-----')) {
      verifierKey = crypto.createPublicKey(verifierKey);
    } else {
      // Base64 DER SPKI format
      verifierKey = crypto.createPublicKey({
        key: Buffer.from(verifierKey, 'base64'),
        format: 'der',
        type: 'spki'
      });
    }
  }

  const canonicalData = canonicalize(credentialObject);
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalData, 'utf8'),
      verifierKey,
      Buffer.from(signatureBase64, 'base64')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Returns Base64-encoded SPKI public key.
 */
function getPublicKeyBase64() {
  if (!publicKeyBase64) {
    initKeys();
  }
  return publicKeyBase64;
}

/**
 * Returns SPKI PEM public key.
 */
function getPublicKeyPem() {
  if (!publicKeyPem) {
    initKeys();
  }
  return publicKeyPem;
}

module.exports = {
  initKeys,
  canonicalize,
  signCredential,
  verifyCredential,
  getPublicKeyBase64,
  getPublicKeyPem
};
