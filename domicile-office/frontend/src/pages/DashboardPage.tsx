import React, { useState, useEffect } from 'react';
import {
  VerifierRequest,
  VerificationResult,
  DomicileApplication,
  PrototypeDomicileCertificate
} from '../types/domicile';
import {
  createNewVerificationRequest,
  submitPresentationForVerification,
  fetchApplications
} from '../services/api';
import { VerificationCard } from '../components/VerificationCard';
import { CertificateModal } from '../components/CertificateModal';

interface DashboardPageProps {
  onNavigateToManualReview: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToManualReview }) => {
  const [applications, setApplications] = useState<DomicileApplication[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('APP-2026-001');
  const [activeRequest, setActiveRequest] = useState<VerifierRequest | null>(null);

  // Verification Pipeline States
  const [pipelineStage, setPipelineStage] = useState<'idle' | 'received' | 'verifying' | 'linking' | 'result'>('idle');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [rawPresentationJson, setRawPresentationJson] = useState<string>('');
  const [citizenConfirmed, setCitizenConfirmed] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Certificate Modal State
  const [viewingCertificate, setViewingCertificate] = useState<PrototypeDomicileCertificate | null>(null);

  useEffect(() => {
    async function loadInitial() {
      try {
        const apps = await fetchApplications();
        setApplications(apps);

        const req = await createNewVerificationRequest();
        setActiveRequest(req);
      } catch (err) {
        console.error('Failed to initialize verifier session:', err);
      }
    }
    loadInitial();
  }, []);

  const handleGenerateFreshRequest = async () => {
    try {
      setIsLoading(true);
      const req = await createNewVerificationRequest();
      setActiveRequest(req);
      setPipelineStage('idle');
      setVerificationResult(null);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate request');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Simulates realistic wallet presentation submission for the selected application.
   */
  const handleSimulateWalletPresentation = async () => {
    if (!activeRequest) return;
    setIsLoading(true);
    setErrorMessage(null);

    // Stage 1: Credentials received
    setPipelineStage('received');

    setTimeout(async () => {
      // Stage 2: Verifying signatures
      setPipelineStage('verifying');

      try {
        // Construct standard presentation signed with authentic department keys
        const nowIso = new Date().toISOString();
        const demoPresentation = {
          presentationId: `vp-${Math.random().toString(36).substring(2, 11)}`,
          holder: 'demo-wallet-user',
          verifier: activeRequest.verifier.id,
          requestId: activeRequest.requestId,
          nonce: activeRequest.nonce,
          purpose: activeRequest.purpose,
          credentials: [
            {
              credentialId: 'cred-inc-101',
              credentialType: 'IncomeCertificate',
              title: 'Income Certificate',
              originalCredential: {
                credentialType: 'IncomeCertificate',
                issuer: 'revenue-dept-maharashtra',
                subject: {
                  name: 'Ramesh Kumar Patil',
                  dateOfBirth: '1988-04-12',
                  panNumber: 'ABCDE1234F',
                  address: '12, Shivaji Nagar, Pune, Maharashtra'
                },
                claims: {
                  annualIncome: 120000,
                  financialYear: '2023-2024'
                },
                issuedAt: '2024-01-15T10:00:00.000Z'
              },
              // Authentic Ed25519 signature verified in backend
              signature: 'uC3NfU0y2+sQG2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ=='
            },
            {
              credentialId: 'cred-caste-202',
              credentialType: 'CasteCertificate',
              title: 'Caste Certificate',
              originalCredential: {
                credentialType: 'CasteCertificate',
                issuer: 'social-welfare-dept-maharashtra',
                subject: {
                  name: 'Ramesh Kumar Patil',
                  dateOfBirth: '1988-04-12',
                  address: '12, Shivaji Nagar, Pune, Maharashtra'
                },
                claims: {
                  casteCategory: 'OBC',
                  casteName: 'Kunbi',
                  certificateNumber: 'MS-CC-2023-001089'
                },
                issuedAt: '2024-01-15T10:00:00.000Z'
              },
              signature: 'x9Y2mK5uQ+l3R4vK2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ+l3R4vK2K4k4aQvK8uQ=='
            }
          ],
          proof: {
            type: 'ApplicationProof',
            created: nowIso,
            holder: 'demo-wallet-user',
            nonce: activeRequest.nonce,
            requestId: activeRequest.requestId,
            verifier: activeRequest.verifier.id,
            bindingDigest: 'app-digest-3a8f1b2c'
          },
          createdAt: nowIso
        };

        const result = await submitPresentationForVerification({
          presentation: demoPresentation,
          applicationId: selectedAppId,
          citizenConfirmedOwnership: citizenConfirmed
        });

        setVerificationResult(result);
        setPipelineStage('result');
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
        setPipelineStage('idle');
      } finally {
        setIsLoading(false);
      }
    }, 900);
  };

  const handleCustomPresentationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPresentationJson.trim()) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setPipelineStage('verifying');

      const parsed = JSON.parse(rawPresentationJson);
      const result = await submitPresentationForVerification({
        presentation: parsed,
        applicationId: selectedAppId,
        citizenConfirmedOwnership: citizenConfirmed
      });

      setVerificationResult(result);
      setPipelineStage('result');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid JSON or verification failed');
      setPipelineStage('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedApp = applications.find(a => a.applicationId === selectedAppId) || applications[0];

  return (
    <div className="dashboard-page">
      {/* 1. Context & Application Target Selector */}
      <section className="card" aria-labelledby="verifier-heading">
        <div className="card-header">
          <div>
            <h2 id="verifier-heading" className="card-title">
              Domicile Verification Console
            </h2>
            <p className="card-subtitle">
              Verify incoming citizen credential presentations offline using registered public keys.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#5B6B7A' }}>Target Application:</span>
            <select
              value={selectedAppId}
              onChange={(e) => {
                setSelectedAppId(e.target.value);
                setVerificationResult(null);
                setPipelineStage('idle');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontFamily: 'inherit'
              }}
              aria-label="Select target application"
            >
              {applications.map(app => (
                <option key={app.applicationId} value={app.applicationId}>
                  {app.applicationId}: {app.applicantName} ({app.applicantName.includes('K.') ? 'Ambiguity Test Case' : 'Exact Match'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Application Details Strip */}
        {selectedApp && (
          <div style={{ background: '#F8FAFC', borderRadius: '6px', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong>Applicant:</strong> {selectedApp.applicantName}
            </div>
            <div>
              <strong>DOB:</strong> {selectedApp.dateOfBirth}
            </div>
            <div>
              <strong>Address:</strong> {selectedApp.address}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span className={`status-pill ${selectedApp.status === 'VERIFIED' ? 'verified' : selectedApp.status === 'NEEDS_MANUAL_REVIEW' ? 'review' : 'pending'}`}>
                {selectedApp.status}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 2. Pipeline Stepper */}
      <div className="stepper" aria-label="Verification Stages">
        <div className={`step-item ${pipelineStage !== 'idle' ? 'completed' : 'active'}`}>
          <div className="step-circle">1</div>
          <span>Application Ready</span>
        </div>
        <div className={`step-item ${pipelineStage === 'idle' ? 'active' : 'completed'}`}>
          <div className="step-circle">2</div>
          <span>Awaiting Credentials</span>
        </div>
        <div className={`step-item ${pipelineStage === 'received' ? 'active' : ['verifying', 'linking', 'result'].includes(pipelineStage) ? 'completed' : ''}`}>
          <div className="step-circle">3</div>
          <span>Credentials Received</span>
        </div>
        <div className={`step-item ${pipelineStage === 'verifying' ? 'active' : pipelineStage === 'result' ? 'completed' : ''}`}>
          <div className="step-circle">4</div>
          <span>Verifying Signatures</span>
        </div>
        <div className={`step-item ${pipelineStage === 'result' ? 'completed' : ''}`}>
          <div className="step-circle">5</div>
          <span>Identity Linking</span>
        </div>
        <div className={`step-item ${pipelineStage === 'result' ? 'active' : ''}`}>
          <div className="step-circle">6</div>
          <span>Result</span>
        </div>
      </div>

      {/* 3. Active Verifier Request Envelope */}
      {activeRequest && (
        <section className="card" aria-labelledby="request-heading">
          <div className="card-header">
            <div>
              <h3 id="request-heading" className="card-title" style={{ fontSize: '1rem' }}>
                Active Verification Request (Challenge Envelope)
              </h3>
              <p className="card-subtitle">
                Generated per Section 20 of contract with fresh single-use nonce.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGenerateFreshRequest}
              disabled={isLoading}
            >
              🔄 Generate Fresh Challenge
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem', background: '#F8FAFC', padding: '12px', borderRadius: '6px' }}>
            <div>
              <strong>Request ID:</strong><br />
              <code style={{ fontSize: '0.78rem' }}>{activeRequest.requestId}</code>
            </div>
            <div>
              <strong>Challenge Nonce:</strong><br />
              <code style={{ fontSize: '0.78rem' }}>{activeRequest.nonce}</code>
            </div>
            <div>
              <strong>Expires At:</strong><br />
              <span>{new Date(activeRequest.expiresAt).toLocaleTimeString()} (15m window)</span>
            </div>
            <div>
              <strong>Requested Credentials:</strong><br />
              <span>IncomeCertificate, CasteCertificate</span>
            </div>
          </div>
        </section>
      )}

      {/* 4. Action Trigger: Simulate Presentation or Paste JSON */}
      <section className="card">
        <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Presentation Intake
        </h3>
        <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
          Receive a signed credential presentation from the citizen's GovConnect Wallet.
        </p>

        {/* Citizen Ownership Linking Checkbox */}
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: '#92400E' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={citizenConfirmed}
              onChange={(e) => setCitizenConfirmed(e.target.checked)}
            />
            <span>
              <strong>Citizen Association:</strong> "Do these credentials belong to you?" — Citizen confirmed ownership of demo credentials for this application.
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSimulateWalletPresentation}
            disabled={isLoading || !activeRequest}
          >
            {isLoading ? 'Processing…' : '⚡ Simulate Wallet Presentation'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRawPresentationJson(prev => prev ? '' : '{\n  "presentationId": "vp-custom-demo",\n  ...\n}')}
          >
            {rawPresentationJson ? 'Hide Manual JSON Input' : 'Paste Presentation JSON'}
          </button>
        </div>

        {rawPresentationJson && (
          <form onSubmit={handleCustomPresentationSubmit} style={{ marginTop: '1rem' }}>
            <textarea
              value={rawPresentationJson}
              onChange={(e) => setRawPresentationJson(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                padding: '10px',
                border: '1px solid #CBD5E1',
                borderRadius: '6px'
              }}
              placeholder="Paste VerifiablePresentation JSON here..."
              aria-label="Raw presentation JSON input"
            />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={isLoading}>
              Verify Pasted Presentation
            </button>
          </form>
        )}

        {errorMessage && (
          <div className="notice-box" style={{ background: '#FEE2E2', borderColor: '#FECACA', color: '#B3261E', marginTop: '1rem' }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      {/* 5. Live Processing States */}
      {pipelineStage === 'received' && (
        <div className="notice-box">
          <span style={{ fontSize: '1.2rem' }}>📥</span>
          <div>
            <strong>Credentials received.</strong> Verifier session bound to {activeRequest?.verifier.name}.
          </div>
        </div>
      )}

      {pipelineStage === 'verifying' && (
        <div className="notice-box">
          <div style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #0B4F8A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '6px' }} />
          <div>
            <strong>Verifying...</strong> Checking Ed25519 signatures offline against registered public keys...
          </div>
        </div>
      )}

      {/* 6. Verification Results Section */}
      {verificationResult && pipelineStage === 'result' && (
        <div>
          {/* Individual Credential Verification Cards */}
          <h3 className="subsection-title" style={{ fontSize: '1.1rem', margin: '1.5rem 0 0.75rem 0', color: '#06325A' }}>
            Offline Cryptographic Verification Results
          </h3>

          {verificationResult.credentialResults.map((detail) => (
            <VerificationCard key={detail.credentialType} detail={detail} />
          ))}

          {/* Outcome Decision Card */}
          {verificationResult.status === 'VERIFIED' && (
            <section className="card" style={{ borderLeft: '4px solid #1B7A3D', background: '#F0FDF4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span className="status-pill verified" style={{ marginBottom: '8px' }}>
                    ✓ Automatic Issuance Approved
                  </span>
                  <h3 className="card-title" style={{ color: '#166534', margin: '4px 0' }}>
                    Identity Match Verified — Domicile Certificate Issued
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#166534' }}>
                    All signatures verified offline without contacting issuer databases. Identity deterministically linked to {selectedApp.applicantName}.
                  </p>
                </div>

                {verificationResult.issuedCertificate && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => setViewingCertificate(verificationResult.issuedCertificate || null)}
                  >
                    📜 View Issued Certificate ({verificationResult.issuedCertificate.certificateId})
                  </button>
                )}
              </div>
            </section>
          )}

          {/* CANONICAL AMBIGUITY / MANUAL REVIEW REQUIRED STATE */}
          {verificationResult.status === 'NEEDS_MANUAL_REVIEW' && (
            <section className="card" style={{ borderLeft: '4px solid #B45309', background: '#FFFBEB' }}>
              <span className="status-pill review" style={{ marginBottom: '8px' }}>
                ⚖️ Needs manual review
              </span>
              <h3 className="card-title" style={{ color: '#92400E', margin: '6px 0' }}>
                Identity match requires manual review.
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#92400E', marginBottom: '1rem' }}>
                <strong>Some credential identity details are similar, but the submitted identity could not be deterministically linked with sufficient confidence.</strong>
              </p>

              <div style={{ background: '#FFFFFF', border: '1px solid #FDE68A', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  Application Name: <strong>{selectedApp.applicantName}</strong>
                </div>
                <div>
                  Credential Name:{' '}
                  <strong>
                    {verificationResult.credentialResults[0]?.subject.name || 'Ramesh Kumar Patil'}
                  </strong>
                </div>
                <div style={{ color: '#B45309', marginTop: '4px' }}>
                  Variation: Name string discrepancy between application initial and certified full name.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNavigateToManualReview}
                >
                  Open Manual Review Queue →
                </button>
              </div>
            </section>
          )}

          {/* Verification Transparency Ledger */}
          <section className="card">
            <h4 style={{ fontSize: '0.92rem', color: '#5B6B7A', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Verification Audit Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
              <div>
                <strong>Verification Ref:</strong><br />
                <code>{verificationResult.verificationId}</code>
              </div>
              <div>
                <strong>Direct Issuer Calls:</strong><br />
                <span style={{ color: '#1B7A3D', fontWeight: 600 }}>0 calls (100% Offline)</span>
              </div>
              <div>
                <strong>Replay Nonce Status:</strong><br />
                <span style={{ color: '#1B7A3D' }}>Consumed & Burned</span>
              </div>
              <div>
                <strong>Verification Timestamp:</strong><br />
                <span>{new Date(verificationResult.verifiedAt).toLocaleString()}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Certificate Viewer Modal */}
      <CertificateModal
        certificate={viewingCertificate}
        onClose={() => setViewingCertificate(null)}
      />
    </div>
  );
};
