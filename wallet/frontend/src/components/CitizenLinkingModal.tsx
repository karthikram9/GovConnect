import React, { useEffect } from 'react';
import { StoredCredential } from '../types/credential';

interface CitizenLinkingModalProps {
  isOpen: boolean;
  credential: StoredCredential | null;
  onConfirm: () => void;
  onReject: () => void;
}

export const CitizenLinkingModal: React.FC<CitizenLinkingModalProps> = ({
  isOpen,
  credential,
  onConfirm,
  onReject
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onReject();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onReject]);

  if (!isOpen || !credential) return null;

  const subject = credential.originalCredential?.subject || {};

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-linking-title"
      onClick={onReject}
    >
      <div
        className="modal-container"
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="modal-category">Citizen Association</span>
            <h2 id="citizen-linking-title" className="modal-title">
              Confirm Credential Ownership
            </h2>
            <p className="modal-issuer">
              Retrieved from: <strong>{credential.issuerName}</strong>
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onReject}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '1.25rem'
          }}>
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '8px' }}>
              We found a cryptographically verified credential issued for:
            </p>
            <div style={{ fontSize: '0.92rem', color: '#1E293B', lineHeight: '1.6' }}>
              <div><strong>Name:</strong> {subject.name || 'Ramesh Kumar Patil'}</div>
              <div><strong>DOB:</strong> {subject.dateOfBirth || '1988-04-12'}</div>
              {subject.panNumber && <div><strong>PAN:</strong> {subject.panNumber}</div>}
              {subject.address && <div><strong>Address:</strong> {subject.address}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '1.5rem 0 1.25rem 0' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#0B4F8A', fontWeight: 600 }}>
              Do these credentials belong to you?
            </h3>
          </div>

          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '0.82rem',
            color: '#92400E',
            lineHeight: '1.5',
            marginBottom: '1.5rem'
          }}>
            <strong>Demo Association Notice:</strong> Confirming links this credential to your prototype wallet session (&quot;demo-wallet-user&quot;). This is a demonstration association only — not legal identity verification, statutory government authentication, Aadhaar verification, or official e-KYC.
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onReject}
              style={{ minWidth: '100px' }}
            >
              No
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConfirm}
              style={{ minWidth: '180px' }}
            >
              Yes, this is mine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
