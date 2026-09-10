import React, { useEffect, useState } from 'react';
import { StoredCredential } from '../types/credential';

interface CredentialModalProps {
  credential: StoredCredential | null;
  onClose: () => void;
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

export const CredentialModal: React.FC<CredentialModalProps> = ({
  credential,
  onClose
}) => {
  const [showFullSignature, setShowFullSignature] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    if (credential) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [credential, onClose]);

  if (!credential) return null;

  const original = credential.originalCredential;
  const claims = original.claims || {};
  const subject = original.subject;
  const isIncome = credential.credentialType === 'IncomeCertificate';

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-credential-title"
      onClick={onClose}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="modal-category">W3C-Inspired Verifiable Credential</span>
            <h2 id="modal-credential-title" className="modal-title">
              {credential.title}
            </h2>
            <p className="modal-issuer">
              {credential.issuerName} &bull; {credential.issuerDept}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Status Indicator Row */}
          <div className="modal-status-row">
            <div className="verified-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Cryptographically Verified (Ed25519)</span>
            </div>
            <span className="modal-badge-preview" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
              Stored in IndexedDB
            </span>
          </div>

          {/* Core Claims Section */}
          <div className="modal-section">
            <h3 className="section-title">Certified Department Claims</h3>
            <div className="claims-grid">
              {isIncome ? (
                <>
                  <div className="claim-box highlight">
                    <span className="claim-label">Certified Annual Income</span>
                    <span className="claim-value big">
                      {formatCurrency(claims.annualIncome)}
                    </span>
                  </div>
                  <div className="claim-box">
                    <span className="claim-label">Permanent Account Number (PAN)</span>
                    <span className="claim-value">{subject.panNumber || 'ABCDE1234F'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="claim-box highlight">
                    <span className="claim-label">Caste Category</span>
                    <span className="claim-value big">
                      {String(claims.casteCategory || 'OBC')}
                    </span>
                  </div>
                  <div className="claim-box">
                    <span className="claim-label">Recognized Caste Name</span>
                    <span className="claim-value">{String(claims.casteName || 'Kunbi')}</span>
                  </div>
                  <div className="claim-box">
                    <span className="claim-label">Certificate Number</span>
                    <span className="claim-value">{String(claims.certificateNumber || 'MS-CC-2023-001089')}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Subject Identification Section */}
          <div className="modal-section">
            <h3 className="section-title">Credential Subject (Demo Identity)</h3>
            <div className="details-list">
              <div className="detail-row">
                <span className="detail-key">Full Name</span>
                <span className="detail-val"><strong>{subject.name}</strong></span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Date of Birth</span>
                <span className="detail-val">{formatDate(subject.dateOfBirth)}</span>
              </div>
              {subject.address && (
                <div className="detail-row">
                  <span className="detail-key">Address</span>
                  <span className="detail-val">{subject.address}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-key">Issued Date</span>
                <span className="detail-val">{formatDate(original.issuedAt)}</span>
              </div>
            </div>
          </div>

          {/* Cryptographic & Trust Metadata */}
          <div className="modal-section">
            <h3 className="section-title">Cryptographic Verification & Trust Metadata</h3>
            <div className="code-box" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
              <p><strong>Storage Key:</strong> <code>{credential.credentialId}</code></p>
              <p><strong>Issuer Authority:</strong> <code>{credential.issuer}</code></p>
              <p><strong>Signature Algorithm:</strong> Ed25519 (RFC 8032 Asymmetric Key)</p>
              <p><strong>Verification Status:</strong> <span style={{ color: '#2E7D32', fontWeight: 600 }}>{credential.verification.status.toUpperCase()}</span></p>
              <p><strong>Trust Verification:</strong> {credential.verification.trustNote}</p>
              <p><strong>Verified At:</strong> {new Date(credential.verification.verifiedAt).toLocaleString('en-IN')}</p>
              <p><strong>Storage Layer:</strong> Edge-Held / Local Device (Browser IndexedDB: <code>govconnect-wallet</code>)</p>
              <div style={{ marginTop: '8px' }}>
                <strong>Ed25519 Digital Signature:</strong>
                <div style={{
                  background: '#F0F4F8',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  fontSize: '0.75rem'
                }}>
                  {showFullSignature ? credential.signature : `${credential.signature.slice(0, 44)}…`}
                  <button
                    type="button"
                    style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#0B4F8A', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setShowFullSignature(!showFullSignature)}
                  >
                    {showFullSignature ? 'Show Less' : 'Show Full'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <p className="footer-note">
            W3C Verifiable Credential-inspired prototype. Stored edge-held in local browser IndexedDB.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
