import React, { useState, useEffect, useCallback } from 'react';
import { StoredCredential } from '../types/credential';
import { getAllStoredCredentials, saveStoredCredential, getAllStoredConsents } from '../services/storage';
import { fetchIncomeCredential, fetchCasteCredential } from '../services/api';
import { CredentialCard, CardStatus } from '../components/CredentialCard';
import { CredentialModal } from '../components/CredentialModal';
import { ConsentModal } from '../components/ConsentModal';
import { CitizenLinkingModal } from '../components/CitizenLinkingModal';
import { QuickAction } from '../components/QuickAction';
import { fetchOrGenerateVerifierRequest } from '../data/demoVerificationRequest';
import { VerifierRequest } from '../types/presentation';

interface HomePageProps {
  onNavigateTab?: (tab: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateTab }) => {
  const [incomeCred, setIncomeCred] = useState<StoredCredential | null>(null);
  const [incomeStatus, setIncomeStatus] = useState<CardStatus>('not_fetched');
  const [incomeError, setIncomeError] = useState<string | undefined>();

  const [casteCred, setCasteCred] = useState<StoredCredential | null>(null);
  const [casteStatus, setCasteStatus] = useState<CardStatus>('not_fetched');
  const [casteError, setCasteError] = useState<string | undefined>();

  const [selectedCredential, setSelectedCredential] = useState<StoredCredential | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [activeVerifierRequest, setActiveVerifierRequest] = useState<VerifierRequest | null>(null);
  const [consentCount, setConsentCount] = useState<number>(0);

  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Citizen linking confirmation state (Section 9 & Contract Section 19)
  const [pendingLinkingCred, setPendingLinkingCred] = useState<StoredCredential | null>(null);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState<boolean>(false);

  const refreshConsentCount = useCallback(async () => {
    try {
      const records = await getAllStoredConsents();
      setConsentCount(records.length);
    } catch (err) {
      console.error('Failed to load consent count:', err);
    }
  }, []);

  // Load stored credentials from local browser IndexedDB on component mount
  useEffect(() => {
    async function loadStored() {
      try {
        const storedList = await getAllStoredCredentials();
        for (const cred of storedList) {
          if (cred.credentialType === 'IncomeCertificate') {
            setIncomeCred(cred);
            setIncomeStatus('verified');
          } else if (cred.credentialType === 'CasteCertificate') {
            setCasteCred(cred);
            setCasteStatus('verified');
          }
        }
        await refreshConsentCount();
      } catch (err) {
        console.error('Failed to load credentials from IndexedDB:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    loadStored();
  }, [refreshConsentCount]);

  const handleConfirmLinking = useCallback(async () => {
    if (!pendingLinkingCred) return;
    try {
      localStorage.setItem('govconnect_demo_linking_confirmed', 'true');
      await saveStoredCredential(pendingLinkingCred);
      if (pendingLinkingCred.credentialType === 'IncomeCertificate') {
        setIncomeCred(pendingLinkingCred);
        setIncomeStatus('verified');
        setNoticeMessage('Income Certificate successfully associated with demo identity and stored in IndexedDB.');
      } else {
        setCasteCred(pendingLinkingCred);
        setCasteStatus('verified');
        setNoticeMessage('Caste Certificate successfully associated with demo identity and stored in IndexedDB.');
      }
    } catch (err) {
      console.error('Failed to save linked credential:', err);
    } finally {
      setIsLinkingModalOpen(false);
      setPendingLinkingCred(null);
    }
  }, [pendingLinkingCred]);

  const handleRejectLinking = useCallback(() => {
    if (pendingLinkingCred?.credentialType === 'IncomeCertificate') {
      setIncomeStatus('not_fetched');
      setNoticeMessage('Credential association declined. Credential was not saved to your wallet.');
    } else {
      setCasteStatus('not_fetched');
      setNoticeMessage('Credential association declined. Credential was not saved to your wallet.');
    }
    setIsLinkingModalOpen(false);
    setPendingLinkingCred(null);
  }, [pendingLinkingCred]);

  const handleFetchIncome = useCallback(async () => {
    setIncomeStatus('fetching');
    setIncomeError(undefined);
    try {
      // Browser calls Wallet backend (:3001), backend calls Revenue (:4001) & verifies Ed25519
      const verified = await fetchIncomeCredential(1);
      const isAlreadyLinked = localStorage.getItem('govconnect_demo_linking_confirmed') === 'true';

      if (!isAlreadyLinked) {
        // Explicit citizen confirmation required on first credential association
        setPendingLinkingCred(verified);
        setIsLinkingModalOpen(true);
      } else {
        // Persist to local browser IndexedDB
        await saveStoredCredential(verified);
        setIncomeCred(verified);
        setIncomeStatus('verified');
        setNoticeMessage('Income Certificate successfully fetched, Ed25519-verified, and stored in IndexedDB.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Income Certificate';
      setIncomeStatus('failed');
      setIncomeError(msg);
    }
  }, []);

  const handleFetchCaste = useCallback(async () => {
    setCasteStatus('fetching');
    setCasteError(undefined);
    try {
      // Browser calls Wallet backend (:3001), backend calls Social Welfare (:4002) & verifies Ed25519
      const verified = await fetchCasteCredential(1);
      const isAlreadyLinked = localStorage.getItem('govconnect_demo_linking_confirmed') === 'true';

      if (!isAlreadyLinked) {
        // Explicit citizen confirmation required on first credential association
        setPendingLinkingCred(verified);
        setIsLinkingModalOpen(true);
      } else {
        // Persist to local browser IndexedDB
        await saveStoredCredential(verified);
        setCasteCred(verified);
        setCasteStatus('verified');
        setNoticeMessage('Caste Certificate successfully fetched, Ed25519-verified, and stored in IndexedDB.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Caste Certificate';
      setCasteStatus('failed');
      setCasteError(msg);
    }
  }, []);

  const handleShareClick = async (_credential: StoredCredential) => {
    const available = [incomeCred, casteCred].filter((c): c is StoredCredential => c !== null);
    if (available.length === 0) {
      setNoticeMessage('No credentials stored yet. Please fetch a certificate before initiating a presentation.');
      return;
    }
    // Retrieve live request from Domicile Office (:5000) or fallback to demo fixture
    const request = await fetchOrGenerateVerifierRequest();
    setActiveVerifierRequest(request);
    setIsConsentModalOpen(true);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'add') {
      if (incomeStatus !== 'verified') {
        handleFetchIncome();
      } else if (casteStatus !== 'verified') {
        handleFetchCaste();
      } else {
        setNoticeMessage('All available demo credentials are already fetched and verified in your wallet.');
      }
    } else if (action === 'consent') {
      onNavigateTab?.('consent');
    }
  };

  const storedCount = (incomeCred ? 1 : 0) + (casteCred ? 1 : 0);

  return (
    <div className="home-dashboard">
      {/* 1. Welcome & Demo Identity Banner */}
      <section className="welcome-banner" aria-labelledby="welcome-heading">
        <div className="welcome-content">
          <div className="welcome-badges-row">
            <span className="demo-mode-pill">
              <span className="dot" aria-hidden="true" />
              Demo Identity: Ramesh Kumar Patil
            </span>
            <span className="edge-held-tag">
              Edge-Held Custody (IndexedDB)
            </span>
          </div>
          <h1 id="welcome-heading" className="welcome-title">
            Welcome to GovConnect
          </h1>
          <p className="welcome-description">
            Your personal, citizen-controlled digital credential wallet. Securely hold and share 
            government-certified documents without intermediate database surveillance or central data aggregation.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#B0BEC5' }}>
            <em>Prototype Notice: This is a demonstration identity used by the SIH26129 prototype. It does not collect or use Aadhaar, nor claim legal identity verification.</em>
          </p>
        </div>
      </section>

      {/* Actionable User Feedback Notice */}
      {noticeMessage && (
        <div className="feedback-alert" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{noticeMessage}</span>
          </div>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => setNoticeMessage(null)}
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      {/* 2. Credentials Section Header & Summary */}
      <section className="credentials-section" aria-labelledby="creds-heading">
        <div className="section-title-bar">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 id="creds-heading" className="section-main-heading">
                My Government Credentials
              </h2>
              <span className="cred-count-badge" aria-label={`${storedCount} credentials stored locally`}>
                {isInitializing ? 'Loading…' : `${storedCount} / 2 stored locally`}
              </span>
            </div>
            <p className="section-subtext">
              Digitally signed verifiable certificates fetched from state issuers and held on this device.
            </p>
          </div>
        </div>

        {/* 3. Credential Cards Grid */}
        <div className="credentials-grid">
          <CredentialCard
            credentialType="IncomeCertificate"
            title="Income Certificate"
            issuerName="Revenue Department"
            issuerDept="Government of Maharashtra"
            storedCredential={incomeCred || undefined}
            status={incomeStatus}
            errorMessage={incomeError}
            onFetch={handleFetchIncome}
            onViewDetails={(c) => setSelectedCredential(c)}
            onShareClick={handleShareClick}
          />

          <CredentialCard
            credentialType="CasteCertificate"
            title="Caste Certificate"
            issuerName="Social Welfare Department"
            issuerDept="Government of Maharashtra"
            storedCredential={casteCred || undefined}
            status={casteStatus}
            errorMessage={casteError}
            onFetch={handleFetchCaste}
            onViewDetails={(c) => setSelectedCredential(c)}
            onShareClick={handleShareClick}
          />
        </div>
      </section>

      {/* 4. Quick Actions Row */}
      <section className="quick-actions-section" aria-labelledby="quick-actions-heading">
        <h3 id="quick-actions-heading" className="subsection-title">
          Quick Actions
        </h3>
        <div className="quick-actions-grid">
          <QuickAction
            title="Add credential"
            description={storedCount < 2 ? "Fetch and verify missing certificates from state departments" : "All prototype credentials are saved locally"}
            badgeText={storedCount < 2 ? "Ready to fetch" : "Complete"}
            onClick={() => handleQuickAction('add')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            }
          />
          <QuickAction
            title="Consent history"
            description="Review authorization logs, active shares, and presentation history"
            badgeText={consentCount > 0 ? `${consentCount} logged` : "Audit log"}
            onClick={() => handleQuickAction('consent')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
          />
        </div>
      </section>

      {/* 5. Trust, Privacy & Data Ownership Section */}
      <section className="trust-section" aria-labelledby="trust-heading">
        <div className="trust-card">
          <div className="trust-header">
            <div className="trust-icon-badge" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 id="trust-heading" className="trust-title">
                Citizen-Controlled Data Custody
              </h3>
              <p className="trust-subtitle">
                Your credentials are cryptographically verified and held locally on your device.
              </p>
            </div>
          </div>

          <div className="trust-points-grid">
            <div className="trust-point">
              <h4>Zero Central Citizen Database</h4>
              <p>
                GovConnect does not maintain a central master database of citizen records. 
                Each government department maintains its own domain records, while credentials 
                are stored directly on your personal device in browser IndexedDB.
              </p>
            </div>

            <div className="trust-point">
              <h4>Cryptographic Ed25519 Verification</h4>
              <p>
                When credentials are retrieved from issuers, their digital signatures are 
                verified using the issuer's registered Ed25519 public key before being stored on your device.
              </p>
            </div>

            <div className="trust-point">
              <h4>Explicit Citizen Consent</h4>
              <p>
                No certificate or personal claim is ever shared without your explicit 
                approval through the <strong>[ Share and consent ]</strong> confirmation flow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Credential Inspection Modal */}
      <CredentialModal
        credential={selectedCredential}
        onClose={() => setSelectedCredential(null)}
      />

      {/* Verifier Share & Consent Modal */}
      {isConsentModalOpen && activeVerifierRequest && (
        <ConsentModal
          request={activeVerifierRequest}
          availableCredentials={[incomeCred, casteCred].filter((c): c is StoredCredential => c !== null)}
          onClose={() => setIsConsentModalOpen(false)}
          onNavigateToConsentHistory={() => {
            setIsConsentModalOpen(false);
            onNavigateTab?.('consent');
          }}
          onSuccess={({ presentation, consentRecord }) => {
            refreshConsentCount();
            setNoticeMessage(
              `Presentation ${presentation.presentationId.slice(0, 16)}... prepared. Consent #${consentRecord.consentId.slice(0, 8)} recorded locally in IndexedDB.`
            );
          }}
        />
      )}

      {/* Citizen Linking Confirmation Modal (Section 9) */}
      <CitizenLinkingModal
        isOpen={isLinkingModalOpen}
        credential={pendingLinkingCred}
        onConfirm={handleConfirmLinking}
        onReject={handleRejectLinking}
      />
    </div>
  );
};

export default HomePage;
