import { config } from '../config';

export interface IssuerCredentialResponse {
  credential: Record<string, unknown>;
  signature: string;
  issuer: string;
}

export class IssuerError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 502
  ) {
    super(message);
    this.name = 'IssuerError';
  }
}

/**
 * Invokes the Revenue Department issuer API to request an Income Certificate.
 * Sends the server-side REVENUE_API_KEY via X-API-Key header.
 */
export async function fetchRevenueCredential(demoCitizenId: number): Promise<IssuerCredentialResponse> {
  const url = `${config.revenueApiUrl.replace(/\/+$/, '')}/issue-credential/${demoCitizenId}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.revenueApiKey
      }
    });

    if (res.status === 401) {
      throw new IssuerError('ISSUER_UNAUTHORIZED', 'Revenue Department rejected authentication key', 502);
    }

    if (res.status === 404) {
      throw new IssuerError('CITIZEN_NOT_FOUND', `Citizen record ${demoCitizenId} not found in Revenue Department`, 404);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string };
      throw new IssuerError('ISSUER_ERROR', errBody.error || `Revenue Department returned HTTP ${res.status}`, 502);
    }

    const data = await res.json() as Partial<IssuerCredentialResponse>;

    if (!data.credential || !data.signature || !data.issuer) {
      throw new IssuerError('ISSUER_MALFORMED_RESPONSE', 'Revenue Department returned incomplete credential payload', 502);
    }

    return data as IssuerCredentialResponse;
  } catch (err: unknown) {
    if (err instanceof IssuerError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new IssuerError('ISSUER_UNAVAILABLE', `Unable to connect to Revenue Department: ${msg}`, 503);
  }
}

/**
 * Invokes the Social Welfare Department issuer API to request a Caste Certificate.
 * Sends the server-side SOCIAL_WELFARE_API_KEY via X-API-Key header.
 */
export async function fetchSocialWelfareCredential(demoCitizenId: number): Promise<IssuerCredentialResponse> {
  const url = `${config.socialWelfareApiUrl.replace(/\/+$/, '')}/issue-credential/${demoCitizenId}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.socialWelfareApiKey
      }
    });

    if (res.status === 401) {
      throw new IssuerError('ISSUER_UNAUTHORIZED', 'Social Welfare Department rejected authentication key', 502);
    }

    if (res.status === 404) {
      throw new IssuerError('CITIZEN_NOT_FOUND', `Citizen record ${demoCitizenId} not found in Social Welfare Department`, 404);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string };
      throw new IssuerError('ISSUER_ERROR', errBody.error || `Social Welfare Department returned HTTP ${res.status}`, 502);
    }

    const data = await res.json() as Partial<IssuerCredentialResponse>;

    if (!data.credential || !data.signature || !data.issuer) {
      throw new IssuerError('ISSUER_MALFORMED_RESPONSE', 'Social Welfare Department returned incomplete credential payload', 502);
    }

    return data as IssuerCredentialResponse;
  } catch (err: unknown) {
    if (err instanceof IssuerError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new IssuerError('ISSUER_UNAVAILABLE', `Unable to connect to Social Welfare Department: ${msg}`, 503);
  }
}
