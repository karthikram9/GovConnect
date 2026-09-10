import { StoredCredential } from '../types/credential';
import { HealthStatus } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function checkBackendHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) {
      return { service: 'govconnect-wallet', status: 'error' };
    }
    return await res.json() as HealthStatus;
  } catch {
    return { service: 'govconnect-wallet', status: 'offline' };
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Requests the Wallet backend to fetch and cryptographically verify
 * the Income Certificate from Revenue Department (port 4001).
 *
 * NOTE: The browser NEVER contacts port 4001 directly and never handles issuer secrets.
 */
export async function fetchIncomeCredential(demoCitizenId: number = 1): Promise<StoredCredential> {
  const url = `${API_BASE_URL}/api/credentials/fetch/income`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId })
    });

    const data = await res.json() as { error?: string; message?: string } & Partial<StoredCredential>;

    if (!res.ok) {
      throw new ApiError(
        data.error || 'FETCH_FAILED',
        data.message || `Failed to fetch Income Certificate (HTTP ${res.status})`,
        res.status
      );
    }

    return data as StoredCredential;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError('NETWORK_ERROR', `Unable to communicate with Wallet Backend (:3001): ${msg}`);
  }
}

/**
 * Requests the Wallet backend to fetch and cryptographically verify
 * the Caste Certificate from Social Welfare Department (port 4002).
 *
 * NOTE: The browser NEVER contacts port 4002 directly and never handles issuer secrets.
 */
export async function fetchCasteCredential(demoCitizenId: number = 1): Promise<StoredCredential> {
  const url = `${API_BASE_URL}/api/credentials/fetch/caste`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoCitizenId })
    });

    const data = await res.json() as { error?: string; message?: string } & Partial<StoredCredential>;

    if (!res.ok) {
      throw new ApiError(
        data.error || 'FETCH_FAILED',
        data.message || `Failed to fetch Caste Certificate (HTTP ${res.status})`,
        res.status
      );
    }

    return data as StoredCredential;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError('NETWORK_ERROR', `Unable to communicate with Wallet Backend (:3001): ${msg}`);
  }
}
