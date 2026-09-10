import {
  VerifierRequest,
  VerificationResult,
  DomicileApplication,
  PrototypeDomicileCertificate,
  TrustedIssuer
} from '../types/domicile';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers
    }
  });

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
