import React, { useState, useEffect } from 'react';
import { ConsentRecord } from '../types/presentation';
import { getAllStoredConsents } from '../services/storage';

interface ConsentHistoryPageProps {
  onReturnHome?: () => void;
}

export const ConsentHistoryPage: React.FC<ConsentHistoryPageProps> = ({ onReturnHome }) => {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadConsents() {
      try {
        const records = await getAllStoredConsents();
        setConsents(records);
      } catch (err) {
        console.error('Failed to load consent history:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConsents();
  }, []);

  return (
    <div className="consent-history-page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header Section */}
      <section className="card" aria-labelledby="consent-title" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 id="consent-title" className="card-title" style={{ fontSize: '1.4rem' }}>
              Consent History Ledger
            </h1>
            <p className="card-subtitle">
              Transparent, edge-held audit log of all credential disclosures authorized from this device.
            </p>
          </div>
          {onReturnHome && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onReturnHome}
            >
              ← Back to Home
            </button>
          )}
        </div>

        {/* Privacy Note Banner */}
        <div style={{
          background: '#EBF3FB',
          border: '1px solid #D0E1F0',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '0.85rem',
          color: '#0B4F8A',
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '1.1rem' }}>🛡️</span>
          <span>
            <strong>Zero Raw Data Retention:</strong> In accordance with the GovConnect contract, this ledger stores cryptographic references and audit metadata only. Zero raw citizen claims, income figures, caste data, or documents are retained in this log.
          </span>
        </div>
      </section>

      {/* Ledger Records List */}
      {isLoading ? (
        <section className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: '#5B6B7A' }}>Loading consent records from local IndexedDB…</p>
        </section>
      ) : consents.length === 0 ? (
        <section className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#B0BEC5' }}>📋</div>
          <h2 style={{ fontSize: '1.2rem', color: '#1A2B3C', marginBottom: '0.5rem' }}>
            No Consent Records Stored Yet
          </h2>
          <p style={{ color: '#5B6B7A', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            When you click <strong>"Share and consent."</strong> on a credential card to authorize sharing with a government verifier, your immutable authorization log will be safely recorded here.
          </p>
          {onReturnHome && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onReturnHome}
            >
              Go to My Credentials
            </button>
          )}
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consents.map((record) => (
            <article
              key={record.consentId}
              className="card"
              style={{
                borderLeft: '4px solid #1B7A3D',
                padding: '1.25rem'
              }}
              aria-labelledby={`consent-item-${record.consentId}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                <div>
                  <h3 id={`consent-item-${record.consentId}`} style={{ fontSize: '1.05rem', color: '#06325A', margin: 0 }}>
                    {record.verifierName}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#5B6B7A', marginTop: '2px' }}>
                    Recipient ID: <code>{record.recipient}</code>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="verified-pill" style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
                    ✓ Consent Granted
                  </span>
                  <div style={{ fontSize: '0.78rem', color: '#5B6B7A', marginTop: '4px' }}>
                    {new Date(record.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: '6px', padding: '10px 12px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <strong>Purpose:</strong> {record.purpose}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem', color: '#5B6B7A' }}>
                <div>
                  <strong>Shared Credentials:</strong>{' '}
                  <span style={{ color: '#1A2B3C' }}>
                    {record.credentialTypesShared.map(t => t === 'IncomeCertificate' ? 'Income Certificate' : 'Caste Certificate').join(', ')}
                  </span>
                </div>
                <div>
                  <strong>Presentation ID:</strong>{' '}
                  <code style={{ fontSize: '0.78rem' }}>{record.presentationId.slice(0, 24)}…</code>
                </div>
                <div>
                  <strong>Request ID:</strong>{' '}
                  <code style={{ fontSize: '0.78rem' }}>{record.requestId}</code>
                </div>
                <div>
                  <strong>Replay Nonce:</strong>{' '}
                  <code style={{ fontSize: '0.78rem' }}>{record.nonce}</code>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
