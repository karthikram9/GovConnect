import React, { useState, useEffect } from 'react';
import { TrustedIssuer } from '../types/domicile';
import { fetchTrustRegistry } from '../services/api';

export const TrustRegistryPage: React.FC = () => {
  const [issuers, setIssuers] = useState<TrustedIssuer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchTrustRegistry();
        setIssuers(data.issuers || []);
      } catch (err) {
        console.error('Failed to load trust registry:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="trust-registry-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Prototype Public-Key Trust Registry</h2>
            <p className="card-subtitle">
              Authoritative public keys for offline verifiable credential verification across Maharashtra departments.
            </p>
          </div>
          <div>
            <span className="status-pill verified">
              ✓ Registry Active (v2.0.1)
            </span>
          </div>
        </div>

        {/* Offline Verification Notice */}
        <div className="notice-box success">
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <div>
            <strong>100% Offline Signature Verification Guarantee:</strong> When a citizen presents credentials to the Domicile Office, digital signatures are checked locally against the public keys listed below. <em>Zero live calls are made to Revenue Department (:4001) or Social Welfare Department (:4002) databases during credential verification.</em>
          </div>
        </div>

        {/* Strict Segregation Rule Notice */}
        <div className="notice-box">
          <span style={{ fontSize: '1.25rem' }}>🔒</span>
          <div>
            <strong>Strict Segregation Rule (Section 8.2 of Contract):</strong> This registry stores only public issuer identities, key identifiers, and Ed25519 public keys. It contains strictly <strong>zero citizen records, PAN, Aadhaar, DOB, income, caste, or address information</strong>.
          </div>
        </div>

        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#5B6B7A' }}>
            Loading Trust Registry…
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            {issuers.map((issuer) => (
              <article
                key={issuer.issuerId}
                className="card"
                style={{
                  borderLeft: '4px solid #0B4F8A',
                  background: '#F8FAFC',
                  margin: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: '#06325A', margin: 0 }}>
                      {issuer.issuerName}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#5B6B7A', marginTop: '2px' }}>
                      {issuer.department}
                    </div>
                  </div>
                  <span className="status-pill verified">
                    {issuer.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#1A2B3C', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>Issuer URN:</strong><br />
                    <code>{issuer.issuerId}</code>
                  </div>

                  <div>
                    <strong>Key ID:</strong> <code>{issuer.keyId}</code>
                  </div>

                  <div>
                    <strong>Authorized Credentials:</strong>{' '}
                    <span>{issuer.credentialTypes.join(', ')}</span>
                  </div>

                  <div>
                    <strong>Ed25519 Public Key (SPKI PEM):</strong>
                    <pre
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '8px',
                        fontSize: '0.74rem',
                        marginTop: '4px',
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                        color: '#06325A'
                      }}
                    >
                      {issuer.publicKey}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Prototype Simplification Disclaimer */}
        <div style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px dashed #CBD5E1', fontSize: '0.82rem', color: '#64748B' }}>
          <strong>Prototype Simplification Notice:</strong> The Trust Registry is implemented inside the Domicile verifier backend as a prototype simplification. A production deployment may operate it as an independently governed registry service or federated National PKI directory.
        </div>
      </section>
    </div>
  );
};
