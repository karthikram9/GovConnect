import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ManualReviewPage } from './pages/ManualReviewPage';
import { TrustRegistryPage } from './pages/TrustRegistryPage';
import { fetchApplications } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('verification');
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);

  useEffect(() => {
    async function updateCounts() {
      try {
        const apps = await fetchApplications();
        const pending = apps.filter(a => a.status === 'NEEDS_MANUAL_REVIEW').length;
        setPendingReviewCount(pending);
      } catch (e) {
        // backend might be starting up
      }
    }
    updateCounts();
    const timer = setInterval(updateCounts, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="domicile-app">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingReviewCount={pendingReviewCount}
      />

      <main className="main-content">
        {activeTab === 'verification' && (
          <DashboardPage
            onNavigateToManualReview={() => setActiveTab('manual-review')}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsPage
            onSelectApplicationForVerification={(_appId) => {
              setActiveTab('verification');
            }}
          />
        )}

        {activeTab === 'manual-review' && (
          <ManualReviewPage />
        )}

        {activeTab === 'trust-registry' && (
          <TrustRegistryPage />
        )}
      </main>
    </div>
  );
};

export default App;
