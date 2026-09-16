import React from 'react';
import { AuthUser } from '../services/api';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewCount?: number;
  currentUser?: AuthUser | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  pendingReviewCount = 0,
  currentUser = null,
  onLoginClick,
  onLogoutClick
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#B0BEC5', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', marginRight: '6px' }} />
              Port 5000/5001 (Verifier)
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '4px', color: '#FFFFFF' }}>
              Offline Ed25519 Engine
            </div>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '4px', color: '#FFFFFF' }}>
                <span>👤 <strong>{currentUser.username}</strong> ({currentUser.role})</span>
                <button
                  type="button"
                  onClick={onLogoutClick}
                  style={{
                    background: '#D32F2F',
                    border: 'none',
                    borderRadius: '3px',
                    color: '#FFF',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                style={{
                  background: '#0B4F8A',
                  border: '1px solid #64B5F6',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  padding: '3px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Officer Login
              </button>
            )}
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
