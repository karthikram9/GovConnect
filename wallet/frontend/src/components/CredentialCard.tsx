import React from 'react';
import { StoredCredential } from '../types/credential';

export type CardStatus = 'not_fetched' | 'fetching' | 'verified' | 'failed';

interface CredentialCardProps {
  credentialType: 'IncomeCertificate' | 'CasteCertificate';
  title: string;
  issuerName: string;
  issuerDept: string;
  storedCredential?: StoredCredential;
  status: CardStatus;
  errorMessage?: string;
  onFetch: () => void;
  onViewDetails: (credential: StoredCredential) => void;
  onShareClick?: (credential: StoredCredential) => void;
}

function formatCurrency(amount: unknown): string {
  if (typeof amount !== 'number') return String(amount || '');
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export const CredentialCard: React.FC<CredentialCardProps> = ({
  credentialType,
  title,
  issuerName,
  issuerDept,
  storedCredential,
  status,
  errorMessage,
  onFetch,
  onViewDetails,
  onShareClick
}) => {
  const isVerified = status === 'verified' && storedCredential;
  const claims = storedCredential?.originalCredential.claims || {};
  const subject = storedCredential?.originalCredential.subject;

  return (
    <article className="credential-card" aria-labelledby={`card-title-${credentialType}`}>
      {/* Top Bar */}
      <div className="card-top-bar">
        <div className="credential-icon-wrapper" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <div className="card-badges">
          {isVerified && (
            <>
              <span className="badge-preview-pill" style={{ background: '#EBF3FB', color: '#0B4F8A' }}>IndexedDB</span>
              <span className="verified-pill" aria-label="Status: Cryptographically Verified">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Verified</span>
              </span>
            </>
          )}

          {status === 'fetching' && (
            <span className="badge-preview-pill" style={{ background: '#E3F2FD', color: '#1565C0' }}>
              Fetching & Verifying…
            </span>
          )}

          {status === 'failed' && (
            <span className="badge-preview-pill" style={{ background: '#FFEBEE', color: '#C62828' }}>
              Fetch Failed
            </span>
          )}

          {status === 'not_fetched' && (
            <span className="badge-preview-pill" style={{ background: '#F0F4F8', color: '#5A6E82' }}>
              Not Stored
            </span>
          )}
        </div>
      </div>

      {/* Header Info */}
      <div className="card-main-info">
        <h3 id={`card-title-${credentialType}`} className="card-cert-title">
          {title}
        </h3>
        <p className="card-issuer-name">{issuerName}</p>
        <p className="card-issuer-sub">{issuerDept}</p>
      </div>

      {/* Main Content Area */}
      {isVerified ? (
        <>
          {/* Key Claim Highlighting */}
          <div className="card-primary-claim">
            {credentialType === 'IncomeCertificate' ? (
              <>
                <span className="claim-subtext">Certified Annual Income</span>
                <span className="claim-highlight-value">
                  {formatCurrency(claims.annualIncome)}
                </span>
              </>
            ) : (
              <>
                <span className="claim-subtext">Caste & Category</span>
                <span className="claim-highlight-value">
                  {String(claims.casteCategory || 'OBC')} ({String(claims.casteName || 'Kunbi')})
                </span>
              </>
            )}
          </div>

          {/* Metadata Row */}
          <div className="card-meta-row">
            <div>
              <span className="meta-label">Holder</span>
              <span className="meta-val">{subject?.name || 'Ramesh Kumar Patil'}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span className="meta-label">Issued</span>
              <span className="meta-val">{formatDate(storedCredential.originalCredential.issuedAt)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="meta-label">
                {credentialType === 'IncomeCertificate' ? 'PAN' : 'Cert No.'}
              </span>
              <span className="meta-val">
                {credentialType === 'IncomeCertificate'
                  ? subject?.panNumber || 'ABCDE1234F'
                  : String(claims.certificateNumber || 'MS-CC-2023-001089')}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#2E7D32', background: '#F1F8E9', padding: '6px 10px', borderRadius: '4px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✓</span>
            <span>Signature verified using the issuer's public key.</span>
          </div>

          {/* Actions */}
          <div className="card-actions-row">
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => onViewDetails(storedCredential)}
              aria-label={`View details for ${title}`}
            >
              View Credential
            </button>
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={() => onShareClick?.(storedCredential)}
              title="Share credential with verifier with explicit consent"
              aria-label={`Share and consent for ${title}`}
            >
              Share and consent
            </button>
          </div>
        </>
      ) : status === 'fetching' ? (
        <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #E0E0E0', borderTopColor: '#0B4F8A', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: '#5A6E82' }}>
            Requesting signed document & verifying Ed25519 signature…
          </p>
        </div>
      ) : status === 'failed' ? (
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: '#D32F2F', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMessage || 'Failed to fetch or cryptographically verify credential.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onFetch}
          >
            Retry Fetch
          </button>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 0' }}>
          <p style={{ fontSize: '0.85rem', color: '#5A6E82', marginBottom: '1rem', minHeight: '42px' }}>
            No credential stored yet. Click below to fetch the signed certificate directly from {issuerName} and store it locally.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onFetch}
            aria-label={`Fetch ${title}`}
          >
            Fetch {title}
          </button>
        </div>
      )}
    </article>
  );
};
