import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ManualReviewPage } from './pages/ManualReviewPage';
import { TrustRegistryPage } from './pages/TrustRegistryPage';
import { OfficerLoginModal } from './components/OfficerLoginModal';
import { fetchApplications, getStoredUser, logoutOfficer, AuthUser } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('verification');
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const updateCounts = useCallback(async () => {
    if (!currentUser) {
      setPendingReviewCount(0);
      return;
    }
    try {
      const apps = await fetchApplications();
      const pending = apps.filter(a => a.status === 'NEEDS_MANUAL_REVIEW').length;
      setPendingReviewCount(pending);
    } catch (e) {
      // Handled by api service
    }
  }, [currentUser]);

  useEffect(() => {
    updateCounts();
    const timer = setInterval(updateCounts, 5000);
    return () => clearInterval(timer);
  }, [updateCounts]);

  useEffect(() => {
    const handleExpired = () => {
      setCurrentUser(null);
      setIsLoginModalOpen(true);
    };
    window.addEventListener('govconnect:auth_expired', handleExpired);
    return () => window.removeEventListener('govconnect:auth_expired', handleExpired);
  }, []);

  const handleTabChange = (tab: string) => {
    if ((tab === 'applications' || tab === 'manual-review') && !currentUser) {
      setIsLoginModalOpen(true);
    }
    setActiveTab(tab);
  };

  const handleLogout = async () => {
    await logoutOfficer();
    setCurrentUser(null);
    setPendingReviewCount(0);
  };

  return (
    <div className="domicile-app">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingReviewCount={pendingReviewCount}
        currentUser={currentUser}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
      />

      <main className="main-content">
        {activeTab === 'verification' && (
          <DashboardPage
            onNavigateToManualReview={() => handleTabChange('manual-review')}
          />
        )}

        {activeTab === 'applications' && (
          currentUser ? (
            <ApplicationsPage
              onSelectApplicationForVerification={(_appId) => {
                setActiveTab('verification');
              }}
            />
          ) : (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <h3>Officer Authentication Required</h3>
              <p style={{ color: '#5B6B7A', margin: '1rem 0' }}>
                Access to the Domicile Applications Registry requires authenticated Review Officer credentials.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsLoginModalOpen(true)}
                style={{ background: '#0B4F8A', color: '#FFF', padding: '0.6rem 1.25rem' }}
              >
                Authenticate as Officer
              </button>
            </div>
          )
        )}

        {activeTab === 'manual-review' && (
          currentUser ? (
            <ManualReviewPage />
          ) : (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <h3>Officer Authentication Required</h3>
              <p style={{ color: '#5B6B7A', margin: '1rem 0' }}>
                Access to the Manual Review Queue requires authenticated Review Officer credentials.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsLoginModalOpen(true)}
                style={{ background: '#0B4F8A', color: '#FFF', padding: '0.6rem 1.25rem' }}
              >
                Authenticate as Officer
              </button>
            </div>
          )
        )}

        {activeTab === 'trust-registry' && (
          <TrustRegistryPage />
        )}
      </main>

      <OfficerLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginModalOpen(false);
        }}
      />
    </div>
  );
};

export default App;
