import {
  VerifierRequest,
  VerificationResult,
  DomicileApplication,
  PrototypeDomicileCertificate,
  TrustedIssuer
} from '../types/domicile';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const AUTH_TOKEN_KEY = 'govconnect_domicile_token';
const AUTH_USER_KEY = 'govconnect_domicile_user';

export interface AuthUser {
  username: string;
  role: string;
  department: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: AuthUser): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

export async function loginOfficer(username: string, password: string): Promise<LoginResponse> {
  const url = `${API_BASE}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `Authentication failed (HTTP ${res.status})`);
  }
  setAuthSession(data.token, data.user);
  return data as LoginResponse;
}

export async function logoutOfficer(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  clearAuthSession();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401) {
    clearAuthSession();
    window.dispatchEvent(new CustomEvent('govconnect:auth_expired'));
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Authentication required');
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Access Denied (HTTP 403 Forbidden)');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchHealth(): Promise<{ service: string; status: string }> {
  return request('/health');
}

export async function fetchTrustRegistry(): Promise<{
  registry: string;
  version: string;
  description: string;
  offlineVerificationPolicy: string;
  issuers: TrustedIssuer[];
}> {
  return request('/api/trust-registry');
}

export async function createNewVerificationRequest(): Promise<VerifierRequest> {
  return request('/api/verification-requests', { method: 'POST' });
}

export async function fetchVerificationRequest(requestId: string): Promise<VerifierRequest> {
  return request(`/api/verification-requests/${requestId}`);
}

export async function submitPresentationForVerification(params: {
  presentation: any;
  applicationId?: string;
  citizenConfirmedOwnership?: boolean;
}): Promise<VerificationResult> {
  return request('/api/presentations/verify', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function fetchApplications(): Promise<DomicileApplication[]> {
  return request('/api/applications');
}

export async function fetchApplication(id: string): Promise<DomicileApplication> {
  return request(`/api/applications/${id}`);
}

export async function submitApplicationReview(
  applicationId: string,
  decision: 'APPROVE' | 'REJECT',
  officerNotes: string
): Promise<{ success: boolean; application?: DomicileApplication; certificate?: PrototypeDomicileCertificate }> {
  return request(`/api/applications/${applicationId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, officerNotes })
  });
}

export async function fetchCertificate(certificateId: string): Promise<PrototypeDomicileCertificate> {
  return request(`/api/certificates/${certificateId}`);
}
