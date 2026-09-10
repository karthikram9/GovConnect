import React, { useState, useEffect } from 'react';
import { VerifierRequest, VerifiablePresentation, ConsentRecord } from '../types/presentation';
import { StoredCredential } from '../types/credential';
import { createPresentation, sharePresentation, PresentationError } from '../services/presentation';

interface ConsentModalProps {
  request: VerifierRequest;
  availableCredentials: StoredCredential[];
  onClose: () => void;
  onSuccess: (result: { presentation: VerifiablePresentation; consentRecord: ConsentRecord }) => void;
  onNavigateToConsentHistory?: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  request,
  availableCredentials,
  onClose,
  onSuccess,
  onNavigateToConsentHistory
}) => {
  // Check which requested credentials are held and verified in the wallet
  const hasIncome = availableCredentials.some(
    c => c.credentialType === 'IncomeCertificate' && c.verification?.status === 'verified'
  );
  const hasCaste = availableCredentials.some(
    c => c.credentialType === 'CasteCertificate' && c.verification?.status === 'verified'
  );

  // Selection state (initially select all available requested credentials)
  const [selectedTypes, setSelectedTypes] = useState<('IncomeCertificate' | 'CasteCertificate')[]>(() => {
    const initial: ('IncomeCertificate' | 'CasteCertificate')[] = [];
    if (hasIncome) initial.push('IncomeCertificate');
    if (hasCaste) initial.push('CasteCertificate');
    return initial;
  });

  // Explicit consent checkbox
  const [consentStatementChecked, setConsentStatementChecked] = useState(false);

  // Flow states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    presentation: VerifiablePresentation;
    consentRecord: ConsentRecord;
  } | null>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleCredentialType = (type: 'IncomeCertificate' | 'CasteCertificate') => {
    setErrorMessage(null);
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleShareAndConsent = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createPresentation({
        request,
        selectedCredentialTypes: selectedTypes,
        consentGranted: consentStatementChecked
      });

      // Submit presentation to Domicile verifier
      await sharePresentation(result.presentation);

      setSuccessData(result);
      onSuccess(result);
    } catch (err: unknown) {
      if (err instanceof PresentationError) {
        setErrorMessage(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to create presentation';
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = new Date(request.expiresAt).getTime() < Date.now();
  const canSubmit = consentStatementChecked && selectedTypes.length > 0 && !isSubmitting && !isExpired;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-container"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <span className="modal-category">Consent & Selective Disclosure</span>
            <h2 id="consent-modal-title" className="modal-title">
              {successData ? 'Credentials ready to share' : 'Share your credentials'}
            </h2>
            <p className="modal-issuer">
              Recipient: <strong>{request.verifier.name}</strong>
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
          {/* Error Banner */}
          {errorMessage && (
            <div className="feedback-alert" role="alert" style={{ background: '#FFEBEE', borderColor: '#FFCDD2', color: '#B71C1C', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button type="button" className="alert-dismiss-btn" onClick={() => setErrorMessage(null)}>&times;</button>
            </div>
          )}

          {/* Expiration Warning */}
          {isExpired && !successData && (
            <div className="feedback-alert" role="alert" style={{ background: '#FFF3E0', borderColor: '#FFE0B2', color: '#E65100', marginBottom: '1rem' }}>
              <span>⚠️ This verification request expired on {new Date(request.expiresAt).toLocaleTimeString()}. Expired requests cannot be shared.</span>
            </div>
          )}

          {/* SUCCESS STATE */}
          {successData ? (
            <div className="success-state-container" style={{ padding: '0.5rem 0' }}>
              <div style={{
                background: '#E8F5E9',
                border: '1px solid #C8E6C9',
                borderRadius: '8px',
                padding: '1.25rem',
                textAlign: 'center',
                marginBottom: '1.25rem'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#2E7D32',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  marginBottom: '0.75rem'
                }}>
                  ✓
                </div>
                <h3 style={{ fontSize: '1.2rem', color: '#1B5E20', marginBottom: '0.5rem' }}>
                  Credentials ready to share
                </h3>
                <p style={{ color: '#2E7D32', fontSize: '0.92rem', lineHeight: '1.5' }}>
                  Your selected credentials were packaged with your consent for <strong>{request.verifier.name}</strong>.
                </p>
              </div>

              {/* Presentation Audit Summary */}
              <div className="code-box" style={{ fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                <p><strong>Presentation ID:</strong> <code>{successData.presentation.presentationId}</code></p>
                <p><strong>Request ID:</strong> <code>{successData.presentation.requestId}</code></p>
                <p><strong>Timestamp:</strong> {new Date(successData.presentation.createdAt).toLocaleString('en-IN')}</p>
                <p><strong>Selected Credentials:</strong> {successData.presentation.credentials.map(c => c.title).join(', ')}</p>
                <p><strong>Consent Status:</strong> <span style={{ color: '#2E7D32', fontWeight: 600 }}>GRANTED BY CITIZEN</span></p>
                <p><strong>Storage:</strong> Edge-Held in local browser IndexedDB (stores <code>presentations</code> & <code>consents</code>)</p>
              </div>

              {/* Prototype Disclosure Notice */}
              <div style={{
                background: '#EBF3FB',
                border: '1px solid #D0E1F0',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#0B4F8A',
                marginBottom: '1.5rem'
              }}>
                <strong>Demo Mode:</strong> Presentation packaged with citizen consent and delivered to Domicile Certificate Office. Verifier validates Ed25519 signatures offline with zero direct issuer contact.
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                {onNavigateToConsentHistory && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      onClose();
                      onNavigateToConsentHistory();
                    }}
                  >
                    View Consent History
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE CONSENT FORM */
            <>
              {/* Request Metadata Card */}
              <div style={{
                background: '#F5F7FA',
                border: '1px solid #D9E1E8',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: '8px', fontSize: '0.88rem' }}>
                  <span style={{ color: '#5B6B7A', fontWeight: 600 }}>Requested by:</span>
                  <span style={{ color: '#1A2B3C', fontWeight: 600 }}>{request.verifier.name}</span>

                  <span style={{ color: '#5B6B7A', fontWeight: 600 }}>Purpose:</span>
                  <span style={{ color: '#1A2B3C' }}>{request.purpose}</span>

                  <span style={{ color: '#5B6B7A', fontWeight: 600 }}>Request ID:</span>
                  <code style={{ fontSize: '0.8rem', color: '#0B4F8A' }}>{request.requestId}</code>

                  <span style={{ color: '#5B6B7A', fontWeight: 600 }}>Replay Nonce:</span>
                  <code style={{ fontSize: '0.8rem', color: '#5B6B7A' }}>{request.nonce}</code>
                </div>
              </div>

              {/* Data Minimization Disclosure */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#F1F8E9',
                border: '1px solid #DCEDC8',
                color: '#2E7D32',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.84rem',
                marginBottom: '1.25rem'
              }}>
                <span style={{ fontSize: '1rem' }}>🛡️</span>
                <span><strong>Data Minimization:</strong> Only the information requested for this verification will be included.</span>
              </div>

              {/* Credentials Requested Checklist */}
              <h3 style={{ fontSize: '1rem', color: '#06325A', marginBottom: '0.75rem' }}>
                Credentials requested
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* 1. Income Certificate Option */}
                <div style={{
                  border: selectedTypes.includes('IncomeCertificate') ? '2px solid #0B4F8A' : '1px solid #D9E1E8',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: hasIncome ? '#FFFFFF' : '#FAFAFA',
                  opacity: hasIncome ? 1 : 0.7
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: hasIncome ? 'pointer' : 'not-allowed', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes('IncomeCertificate')}
                        disabled={!hasIncome}
                        onChange={() => toggleCredentialType('IncomeCertificate')}
                        style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#0B4F8A' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#1A2B3C', fontSize: '0.98rem' }}>
                          Income Certificate
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#5B6B7A' }}>
                          Revenue Department, Government of Maharashtra
                        </div>
                      </div>
                    </label>

                    {hasIncome ? (
                      <span className="verified-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                        ✓ Available in Wallet
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: '#ECEFF1', color: '#546E7A', padding: '2px 8px', borderRadius: '12px' }}>
                        Not stored in Wallet
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '0.75rem', paddingLeft: '28px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#5B6B7A', marginBottom: '4px', fontWeight: 600 }}>
                      Requested claims:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#1A2B3C', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <li>Full Name</li>
                      <li>Date of birth</li>
                      <li>Residential Address</li>
                      <li>Annual income</li>
                    </ul>
                  </div>
                </div>

                {/* 2. Caste Certificate Option */}
                <div style={{
                  border: selectedTypes.includes('CasteCertificate') ? '2px solid #0B4F8A' : '1px solid #D9E1E8',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: hasCaste ? '#FFFFFF' : '#FAFAFA',
                  opacity: hasCaste ? 1 : 0.7
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: hasCaste ? 'pointer' : 'not-allowed', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes('CasteCertificate')}
                        disabled={!hasCaste}
                        onChange={() => toggleCredentialType('CasteCertificate')}
                        style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#0B4F8A' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#1A2B3C', fontSize: '0.98rem' }}>
                          Caste Certificate
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#5B6B7A' }}>
                          Social Welfare Department, Government of Maharashtra
                        </div>
                      </div>
                    </label>

                    {hasCaste ? (
                      <span className="verified-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                        ✓ Available in Wallet
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: '#ECEFF1', color: '#546E7A', padding: '2px 8px', borderRadius: '12px' }}>
                        Not stored in Wallet
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '0.75rem', paddingLeft: '28px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#5B6B7A', marginBottom: '4px', fontWeight: 600 }}>
                      Requested claims:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#1A2B3C', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <li>Full Name</li>
                      <li>Date of birth</li>
                      <li>Residential Address</li>
                      <li>Caste category</li>
                      <li>Caste name</li>
                      <li>Certificate number</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Explicit Consent Declaration */}
              <div style={{
                background: '#FBFDFF',
                border: '1px solid #C4D7E8',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={consentStatementChecked}
                    onChange={(e) => setConsentStatementChecked(e.target.checked)}
                    style={{ marginTop: '4px', width: '20px', height: '20px', accentColor: '#0B4F8A' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#1A2B3C', lineHeight: '1.5', fontWeight: 500 }}>
                    "I understand which information will be shared, who will receive it, and why it is being requested. I consent to this sharing."
                  </span>
                </label>
              </div>

              {/* Modal Footer / Action Buttons */}
              <div className="modal-footer" style={{ borderTop: '1px solid #D9E1E8', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canSubmit}
                  onClick={handleShareAndConsent}
                  style={{ minWidth: '180px' }}
                >
                  {isSubmitting ? 'Packaging Presentation…' : 'Share and consent'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
