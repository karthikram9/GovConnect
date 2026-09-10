import React from 'react';
import { PrototypeDomicileCertificate } from '../types/domicile';

interface CertificateModalProps {
  certificate: PrototypeDomicileCertificate | null;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({ certificate, onClose }) => {
  if (!certificate) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-dialog-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 50, 90, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Certificate Border Container */}
        <div className="certificate-preview">
          <div className="cert-stamp">PROTOTYPE ISSUED</div>

          <div className="cert-header">
            <div className="cert-dept">Government of Maharashtra</div>
            <div className="cert-dept" style={{ fontWeight: 600, color: '#0B4F8A' }}>
              Revenue & General Administration Department
            </div>
            <h2 id="cert-dialog-title" className="cert-main-title">
              Certificate of Domicile
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#5B6B7A', fontFamily: 'monospace' }}>
              Certificate No: <strong>{certificate.certificateId}</strong>
            </div>
          </div>

          <div className="cert-body">
            <p style={{ marginBottom: '1rem' }}>
              This is to certify that <strong>{certificate.applicant.name}</strong>, residing at{' '}
              <em>{certificate.applicant.address}</em> (Date of Birth: {certificate.applicant.dateOfBirth}),
              has submitted verified credentials from state authorities satisfying the domicile documentation requirements.
            </p>

            <div className="cert-grid">
              <div>
                <span style={{ fontSize: '0.78rem', color: '#5B6B7A', display: 'block' }}>Income Eligibility</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1B7A3D' }}>
                  {certificate.verifiedClaims.incomeStatus}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#5B6B7A', display: 'block' }}>Category Classification</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0B4F8A' }}>
                  {certificate.verifiedClaims.casteStatus}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#5B6B7A', display: 'block' }}>Issuance Mode</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {certificate.issuanceMode === 'AUTOMATIC' ? 'Automatic (Deterministic Match)' : 'Approved via Human Review'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#5B6B7A', display: 'block' }}>Verification Ref</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#5B6B7A' }}>
                  {certificate.verificationReference.slice(0, 18)}…
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', fontSize: '0.85rem', color: '#5B6B7A' }}>
              <div>
                Date of Issue:{' '}
                <strong>
                  {new Date(certificate.issuedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                Issuing Authority:<br />
                <strong>{certificate.issuingAuthority}</strong>
              </div>
            </div>

            {/* MANDATORY PROTOTYPE DISCLAIMER */}
            <div className="cert-disclaimer">
              {certificate.disclaimer}
            </div>
          </div>
        </div>

        {/* Modal Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            🖨️ Print Certificate
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
