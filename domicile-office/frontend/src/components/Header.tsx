import React from 'react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  pendingReviewCount = 0
}) => {
  return (
    <header>
      {/* Main Brand Bar */}
      <div className="inst-header">
        <div className="header-container">
          <div className="header-branding">
            <div className="emblem-placeholder" aria-hidden="true">
              🏛️
            </div>
            <div className="brand-titles">
              <h1>
                GovConnect
                <span className="brand-badge">Verifier Console</span>
              </h1>
              <div className="brand-sub">
                Domicile Certificate Office — Revenue & General Administration Department, Government of Maharashtra
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', color: '#B0BEC5' }}>
            <div>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', marginRight: '6px' }} />
              Port 5000/5001 (Verifier)
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '4px', color: '#FFFFFF' }}>
              Offline Ed25519 Engine
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory 4px Saffron / White / Green Tricolor Strip */}
      <div className="tricolor-strip" aria-hidden="true">
        <div className="saffron" />
        <div className="white" />
        <div className="green" />
      </div>

      {/* Subnavigation Bar */}
      <nav className="subnav-bar" aria-label="Verifier Console Navigation">
        <div className="subnav-container">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'verification' ? 'active' : ''}`}
            onClick={() => onTabChange('verification')}
          >
            <span>🔍</span>
            <span>Verification Console</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => onTabChange('applications')}
          >
            <span>📄</span>
            <span>Applications</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'manual-review' ? 'active' : ''}`}
            onClick={() => onTabChange('manual-review')}
          >
            <span>⚖️</span>
            <span>Manual Review Queue</span>
            {pendingReviewCount > 0 && (
              <span className="nav-count-badge alert">
                {pendingReviewCount} pending
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'trust-registry' ? 'active' : ''}`}
            onClick={() => onTabChange('trust-registry')}
          >
            <span>🛡️</span>
            <span>Trust Registry</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
