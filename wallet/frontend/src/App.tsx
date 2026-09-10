import React, { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { ConsentHistoryPage } from './pages/ConsentHistoryPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomePage onNavigateTab={setActiveTab} />}

      {activeTab === 'credentials' && (
        <section className="card" aria-labelledby="creds-tab-heading">
          <h2 id="creds-tab-heading" className="card-title">All Credentials</h2>
          <p className="card-subtitle">Detailed filterable view of stored verifiable certificates.</p>
          <div className="info-item">
            <h4>Step 2 Scope Notice</h4>
            <p>
              In this step, preview credentials are displayed on the <strong>Home</strong> tab. Full list filtering, 
              sorting, and offline credential management will be extended in subsequent steps.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setActiveTab('home')}
            style={{ marginTop: '16px' }}
          >
            Return to Home Dashboard
          </button>
        </section>
      )}

      {activeTab === 'consent' && (
        <ConsentHistoryPage onReturnHome={() => setActiveTab('home')} />
      )}
    </AppLayout>
  );
};

export default App;
