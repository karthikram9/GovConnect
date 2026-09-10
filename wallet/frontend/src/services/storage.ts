import { openDB, IDBPDatabase } from 'idb';
import { StoredCredential } from '../types/credential';
import {
  VerifiablePresentation,
  ConsentRecord,
  ConsumedRequestRecord
} from '../types/presentation';

const DB_NAME = 'govconnect-wallet';
const DB_VERSION = 2;

const STORE_CREDENTIALS = 'credentials';
const STORE_PRESENTATIONS = 'presentations';
const STORE_CONSENTS = 'consents';
const STORE_CONSUMED_REQUESTS = 'consumed_requests';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: Credentials (Edge-held verified certificates)
        if (!db.objectStoreNames.contains(STORE_CREDENTIALS)) {
          db.createObjectStore(STORE_CREDENTIALS, { keyPath: 'credentialId' });
        }
        // Store 2: Presentations (Locally prepared Verifiable Presentations)
        if (!db.objectStoreNames.contains(STORE_PRESENTATIONS)) {
          db.createObjectStore(STORE_PRESENTATIONS, { keyPath: 'presentationId' });
        }
        // Store 3: Consents (Audit ledger containing references only — NO raw claims)
        if (!db.objectStoreNames.contains(STORE_CONSENTS)) {
          db.createObjectStore(STORE_CONSENTS, { keyPath: 'consentId' });
        }
        // Store 4: Consumed Requests (Replay protection for requestIds and nonces)
        if (!db.objectStoreNames.contains(STORE_CONSUMED_REQUESTS)) {
          db.createObjectStore(STORE_CONSUMED_REQUESTS, { keyPath: 'requestId' });
        }
      }
    });
  }
  return dbPromise;
}

/* ==========================================================================
   1. CREDENTIAL STORAGE (Edge-Held in IndexedDB)
   ========================================================================== */

export async function getAllStoredCredentials(): Promise<StoredCredential[]> {
  const db = await getDB();
  return db.getAll(STORE_CREDENTIALS);
}

export async function getStoredCredential(credentialId: string): Promise<StoredCredential | undefined> {
  const db = await getDB();
  return db.get(STORE_CREDENTIALS, credentialId);
}

export async function saveStoredCredential(credential: StoredCredential): Promise<void> {
  const db = await getDB();
  await db.put(STORE_CREDENTIALS, credential);
}

export async function removeStoredCredential(credentialId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_CREDENTIALS, credentialId);
}

export async function clearAllStoredCredentials(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_CREDENTIALS);
}

/* ==========================================================================
   2. PRESENTATION STORAGE (Prepared Edge-Held Packages)
   ========================================================================== */

export async function getAllStoredPresentations(): Promise<VerifiablePresentation[]> {
  const db = await getDB();
  return db.getAll(STORE_PRESENTATIONS);
}

export async function getStoredPresentation(presentationId: string): Promise<VerifiablePresentation | undefined> {
  const db = await getDB();
  return db.get(STORE_PRESENTATIONS, presentationId);
}

export async function saveStoredPresentation(presentation: VerifiablePresentation): Promise<void> {
  const db = await getDB();
  await db.put(STORE_PRESENTATIONS, presentation);
}

/* ==========================================================================
   3. CONSENT AUDIT LEDGER (References Only — ZERO Raw Claims)
   ========================================================================== */

export async function getAllStoredConsents(): Promise<ConsentRecord[]> {
  const db = await getDB();
  const list = await db.getAll(STORE_CONSENTS);
  // Sort descending by timestamp
  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function saveConsentRecord(record: ConsentRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE_CONSENTS, record);
}

/* ==========================================================================
   4. REPLAY PROTECTION (Consumed Requests & Nonces)
   ========================================================================== */

export async function isRequestConsumed(requestId: string, nonce: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORE_CONSUMED_REQUESTS, requestId) as ConsumedRequestRecord | undefined;
  if (!record) {
    // Also scan in case nonce was consumed under another requestId
    const all = await db.getAll(STORE_CONSUMED_REQUESTS) as ConsumedRequestRecord[];
    return all.some(r => r.nonce === nonce);
  }
  return true;
}

export async function markRequestConsumed(record: ConsumedRequestRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE_CONSUMED_REQUESTS, record);
}

/**
 * Resets the entire wallet storage (useful for demo resets).
 */
export async function clearAllWalletStorage(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_CREDENTIALS);
  await db.clear(STORE_PRESENTATIONS);
  await db.clear(STORE_CONSENTS);
  await db.clear(STORE_CONSUMED_REQUESTS);
}
