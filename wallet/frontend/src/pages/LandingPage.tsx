import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { StatusBadge } from '../components/StatusBadge';
import { ECOSYSTEM_SERVICES } from '../lib/constants';
import { getApiBaseUrl } from '../services/api';

export const LandingPage: React.FC = () => {
  const { health, loading, refreshHealth } = useHealth();
  const isOnline = health?.status === 'ok';

  return (
    <div className="landing-page">
      {/* System Status Card */}
      <section className="card" aria-labelledby="status-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 id="status-title" className="card-title">Wallet Environment Status</h2>
            <p className="card-subtitle" style={{ marginBottom: 0 }}>
              Backend connection: <code>{getApiBaseUrl()}</code>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {loading ? (
              <span className="status-pill">Checking...</span>
            ) : (
              <StatusBadge
                status={isOnline ? 'Backend Online (Port 3001)' : (health?.status || 'Offline')}
                isOnline={isOnline}
              />
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={refreshHealth}
              disabled={loading}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Check Health
            </button>
          </div>
        </div>

        {health && (
          <div className="code-box" style={{ marginTop: '16px' }}>
            <strong>GET /health Response:</strong>
            <pre>{JSON.stringify(health, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Core Architectural Guarantees Grid */}
      <div className="grid-2">
        <section className="card" aria-labelledby="edge-held-title">
          <h3 id="edge-held-title" className="card-title">1. Edge-Held Architecture</h3>
          <p className="card-subtitle">Citizen-controlled data custody with zero central registry</p>
          <div className="info-item">
            <h4>No Central Citizen Database</h4>
            <p>The Wallet does NOT maintain a centralized database of citizens. Department records remain isolated at each issuer.</p>
          </div>
          <div className="info-item">
            <h4>Device-Local Storage (Prepared for IndexedDB)</h4>
            <p>Credentials fetched by the citizen will reside in local browser storage, ensuring the citizen retains custody over their verifiable credentials.</p>
          </div>
          <div className="info-item">
            <h4>Offline Verification Ready</h4>
            <p>Downstream authorities verify credentials offline using issuer public keys. No transactional phone-home occurs during verification.</p>
          </div>
        </section>

        <section className="card" aria-labelledby="identity-title">
          <h3 id="identity-title" className="card-title">2. Identity & Security Model</h3>
          <p className="card-subtitle">Strict compliance with the Security & Interoperability Contract v2</p>
          <div className="info-item">
            <h4>Aadhaar Is Completely Excluded</h4>
            <p>No Aadhaar numbers, biometric data, or UIDAI integrations are used or simulated in this prototype.</p>
          </div>
          <div className="info-item">
            <h4>Demo Identity Context (<code>demo-wallet-user</code>)</h4>
            <p>The prototype uses an application-level demo profile. As codified in the contract: <em>Cryptographic signature validity is never treated as identity proof.</em></p>
          </div>
          <div className="info-item">
            <h4>Original Payload Verification</h4>
            <p>The transition adapter guarantees that v1 credentials will be cryptographically verified against original signatures before any v2 normalization occurs.</p>
          </div>
        </section>
      </div>

      {/* Ecosystem Services Overview */}
      <section className="card" aria-labelledby="ecosystem-title">
        <h3 id="ecosystem-title" className="card-title">3. GovConnect Trust Ecosystem</h3>
        <p className="card-subtitle">Integrated issuing authorities and verifier services</p>

        <div className="grid-3">
          <div className="info-item" style={{ borderLeftColor: '#0B4F8A' }}>
            <h4>{ECOSYSTEM_SERVICES.revenueDept.name}</h4>
            <p><strong>Role:</strong> {ECOSYSTEM_SERVICES.revenueDept.role}</p>
            <p><strong>Credential:</strong> <code>{ECOSYSTEM_SERVICES.revenueDept.credential}</code></p>
            <p><strong>Port:</strong> <code>{ECOSYSTEM_SERVICES.revenueDept.defaultPort}</code></p>
          </div>

          <div className="info-item" style={{ borderLeftColor: '#0B4F8A' }}>
            <h4>{ECOSYSTEM_SERVICES.socialWelfareDept.name}</h4>
            <p><strong>Role:</strong> {ECOSYSTEM_SERVICES.socialWelfareDept.role}</p>
            <p><strong>Credential:</strong> <code>{ECOSYSTEM_SERVICES.socialWelfareDept.credential}</code></p>
            <p><strong>Port:</strong> <code>{ECOSYSTEM_SERVICES.socialWelfareDept.defaultPort}</code></p>
          </div>

          <div className="info-item" style={{ borderLeftColor: '#1B7A3D' }}>
            <h4>{ECOSYSTEM_SERVICES.domicileOffice.name}</h4>
            <p><strong>Role:</strong> {ECOSYSTEM_SERVICES.domicileOffice.role}</p>
            <p><strong>Verification:</strong> Offline Ed25519 public key</p>
            <p><strong>Port:</strong> <code>{ECOSYSTEM_SERVICES.domicileOffice.defaultPort}</code></p>
          </div>
        </div>
      </section>

      {/* Step 1 Scope Note */}
      <section className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
        <h3 className="card-title" style={{ color: 'var(--color-warning)' }}>Step 1 Foundation Scope</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          This concludes <strong>Step 1</strong>: establishing the frontend application shell (port 3000), thin backend service (port 3001), 
          configuration, and project structure. Subsequent steps will implement credential retrieval from the Revenue and Social Welfare issuers, 
          local credential management, and presentation exchange with the Domicile Office.
        </p>
      </section>
    </div>
  );
};
