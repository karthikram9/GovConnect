import React, { useState, useEffect } from 'react';
import { DomicileApplication, PrototypeDomicileCertificate } from '../types/domicile';
import { fetchApplications, submitApplicationReview } from '../services/api';
import { CertificateModal } from '../components/CertificateModal';

export const ManualReviewPage: React.FC = () => {
  const [applications, setApplications] = useState<DomicileApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<DomicileApplication | null>(null);
  const [officerNotes, setOfficerNotes] = useState<string>(
    'Verified demographic variance in person. Supporting affidavit on file.'
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [issuedCertificate, setIssuedCertificate] = useState<PrototypeDomicileCertificate | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadPending = async () => {
    try {
      setIsLoading(true);
      const all = await fetchApplications();
      // Filter for applications needing review or all
      const reviewNeeded = all.filter(a => a.status === 'NEEDS_MANUAL_REVIEW');
      setApplications(reviewNeeded.length > 0 ? reviewNeeded : all.filter(a => a.applicantName.includes('K.')));
      if (reviewNeeded.length > 0) {
        setSelectedApp(reviewNeeded[0]);
      } else {
        setSelectedApp(all.find(a => a.applicantName.includes('K.')) || all[0]);
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedApp) return;

    try {
      setIsLoading(true);
      const res = await submitApplicationReview(
        selectedApp.applicationId,
        decision,
        officerNotes
      );

      if (decision === 'APPROVE' && res.certificate) {
        setIssuedCertificate(res.certificate);
        setFeedbackMessage(
          `Application ${selectedApp.applicationId} approved. Prototype Domicile Certificate #${res.certificate.certificateId} issued.`
        );
      } else {
        setFeedbackMessage(
          `Application ${selectedApp.applicationId} rejected after manual review.`
        );
      }

      await loadPending();
    } catch (err: unknown) {
      setFeedbackMessage(err instanceof Error ? err.message : 'Review action failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="manual-review-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Administrative Manual Review Queue</h2>
            <p className="card-subtitle">
              Adjudicate credential presentations flagged by the deterministic matching engine.
            </p>
          </div>
          <div>
            <span className="status-pill review">
              ⚖️ Human Review Active
            </span>
          </div>
        </div>

        {/* Prototype Explanation Notice */}
        <div className="notice-box warning">
          <span>⚠️</span>
          <div>
            <strong>Canonical Ambiguity Demo:</strong> The system detects name variations between <em>"Ramesh Kumar Patil"</em> and <em>"Ramesh K. Patil"</em> and routes to this queue instead of silently auto-issuing.
          </div>
        </div>

        {feedbackMessage && (
          <div className="notice-box success" style={{ marginBottom: '1.25rem' }}>
            <span>✓</span>
            <div>{feedbackMessage}</div>
          </div>
        )}

        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#5B6B7A' }}>
            Loading review queue…
          </p>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ color: '#1A2B3C', fontSize: '1.15rem' }}>Review Queue Clear</h3>
            <p style={{ color: '#5B6B7A', fontSize: '0.9rem', maxWidth: '450px', margin: '0.5rem auto' }}>
              No applications are currently awaiting human review. Present credentials for <strong>Ramesh K. Patil</strong> from the Verification Console to trigger this queue.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '1.5rem' }}>
            {/* Queue List */}
            <div style={{ borderRight: '1px solid #D9E1E8', paddingRight: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#5B6B7A', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                Pending Review Cases ({applications.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {applications.map((app) => (
                  <button
                    key={app.applicationId}
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: selectedApp?.applicationId === app.applicationId ? '2px solid #0B4F8A' : '1px solid #CBD5E1',
                      background: selectedApp?.applicationId === app.applicationId ? '#EBF3FB' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#06325A' }}>
                      {app.applicantName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#5B6B7A' }}>
                      {app.applicationId} • {app.address.split(',')[0]}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span className="status-pill review" style={{ fontSize: '0.72rem' }}>
                        {app.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Review Adjudication Panel */}
            {selectedApp && (
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#06325A', marginBottom: '0.5rem' }}>
                  Adjudicating: {selectedApp.applicationId} ({selectedApp.applicantName})
                </h3>

                {/* Demographic Comparison Table */}
                <div style={{ background: '#F8FAFC', border: '1px solid #D9E1E8', borderRadius: '6px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#5B6B7A', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Demographic Attribute Comparison
                  </h4>

                  <table className="data-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th>Attribute</th>
                        <th>Application Data</th>
                        <th>Presented Credential Data</th>
                        <th>Match Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Full Name</strong></td>
                        <td>{selectedApp.applicantName}</td>
                        <td>Ramesh Kumar Patil</td>
                        <td>
                          <span className="status-pill review">Variance (Initial)</span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Date of Birth</strong></td>
                        <td>{selectedApp.dateOfBirth}</td>
                        <td>{selectedApp.dateOfBirth}</td>
                        <td>
                          <span className="status-pill verified">Exact Match</span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Address / District</strong></td>
                        <td>{selectedApp.address}</td>
                        <td>12, Shivaji Nagar, Pune, Maharashtra</td>
                        <td>
                          <span className="status-pill verified">Exact Match</span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Signatures</strong></td>
                        <td colSpan={2}>
                          Revenue Dept (Income) & Social Welfare Dept (Caste)
                        </td>
                        <td>
                          <span className="status-pill verified">Both Valid Ed25519</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Reason for Review Box */}
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 14px', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#92400E' }}>
                  <strong>Review Flag Reason:</strong>
                  <p style={{ marginTop: '4px' }}>
                    Some credential identity details are similar, but the submitted identity could not be deterministically linked with sufficient confidence. Officer judgment is required to verify applicant identity representation.
                  </p>
                </div>

                {/* Officer Notes Input */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="officer-notes" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1A2B3C', marginBottom: '4px' }}>
                    Officer Administrative Notes (Audit Record):
                  </label>
                  <textarea
                    id="officer-notes"
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Review Actions */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleDecision('APPROVE')}
                    disabled={isLoading}
                  >
                    ✓ Approve Application & Issue Domicile Certificate
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDecision('REJECT')}
                    disabled={isLoading}
                  >
                    ✕ Reject Application
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <CertificateModal
        certificate={issuedCertificate}
        onClose={() => setIssuedCertificate(null)}
      />
    </div>
  );
};
