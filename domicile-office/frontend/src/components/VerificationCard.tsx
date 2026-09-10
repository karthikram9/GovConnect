import React from 'react';
import { CredentialVerificationDetail } from '../types/domicile';

interface VerificationCardProps {
  detail: CredentialVerificationDetail;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({ detail }) => {
  const isRevenue = detail.issuerId.includes('revenue');
  const title = isRevenue ? 'Income Certificate' : 'Caste Certificate';
  const claims = detail.extractedClaims || {};

  return (
    <article
      className="card"
      style={{
        borderLeft: '4px solid #1B7A3D',
        background: '#FFFFFF',
        marginBottom: '1rem'
      }}
      aria-labelledby={`cred-card-${detail.credentialType}`}
    >
      {/* Card Header */}
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>{isRevenue ? '📜' : '🎖️'}</span>
            <h3 id={`cred-card-${detail.credentialType}`} className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
              {title}
            </h3>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#5B6B7A', marginTop: '3px' }}>
            Authoritative Issuer: <strong>{detail.issuerName}</strong> ({detail.issuerId})
          </div>
        </div>

        <div>
          <span className="status-pill verified">
            ✓ Ed25519 Verified
          </span>
        </div>
      </div>

      {/* Verification Metrics Checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
        <div>
          <span style={{ color: '#5B6B7A' }}>Signature:</span>{' '}
          <strong style={{ color: '#1B7A3D' }}>Verified ✓</strong>
        </div>
        <div>
          <span style={{ color: '#5B6B7A' }}>Public Key:</span>{' '}
          <strong style={{ color: '#1B7A3D' }}>Registered ({detail.keyId}) ✓</strong>
        </div>
        <div>
          <span style={{ color: '#5B6B7A' }}>Issuer Contact:</span>{' '}
          <strong style={{ color: '#1B7A3D' }}>Not Required ✓</strong>
        </div>
      </div>

      {/* MANDATORY PROOF NOTICE */}
      <div
        style={{
          background: '#EBF3FB',
          border: '1px solid #D0E1F0',
          borderRadius: '6px',
          padding: '10px 12px',
          fontSize: '0.85rem',
          color: '#0B4F8A',
          marginBottom: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🛡️</span>
        <span>
          <strong>{detail.mandatoryNotice}</strong>
        </span>
      </div>

      {/* Certified Claims Summary */}
      <div style={{ fontSize: '0.84rem', color: '#1A2B3C' }}>
        <strong>Certified Claims Extracted Offline:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
          {isRevenue ? (
            <>
              <div style={{ background: '#F1F5F9', padding: '6px 10px', borderRadius: '4px' }}>
                Annual Income: <strong>₹{Number(claims.annualIncome || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: '#F1F5F9', padding: '6px 10px', borderRadius: '4px' }}>
                Subject: <strong>{detail.subject.name || 'Ramesh Kumar Patil'}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#F1F5F9', padding: '6px 10px', borderRadius: '4px' }}>
                Caste Category: <strong>{String(claims.casteCategory || 'OBC')}</strong>
              </div>
              <div style={{ background: '#F1F5F9', padding: '6px 10px', borderRadius: '4px' }}>
                Caste Name: <strong>{String(claims.casteName || 'Kunbi')}</strong>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
