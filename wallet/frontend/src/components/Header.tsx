import React from 'react';
import { ProfileMenu } from './ProfileMenu';

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'home',
  onTabChange
}) => {
  return (
    <header className="gov-header">
      <div className="header-inner">
        {/* Left: Branding & Wordmark */}
        <div className="branding-group">
          {/* Generic geometric emblem placeholder (NOT national emblem) */}
          <div className="emblem-placeholder" aria-label="GovConnect Institutional Emblem">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          </div>
          <div className="title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="gov-wordmark">GovConnect</span>
              <span className="wallet-badge">Wallet</span>
            </div>
            <p className="gov-subtext">Citizen Credential Wallet — Government of Maharashtra (Prototype)</p>
          </div>
        </div>

        {/* Center: Structured Navigation Shell */}
        <nav className="header-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => onTabChange?.('home')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
          >
            Home
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => onTabChange?.('credentials')}
            aria-current={activeTab === 'credentials' ? 'page' : undefined}
          >
            Credentials
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'consent' ? 'active' : ''}`}
            onClick={() => onTabChange?.('consent')}
            aria-current={activeTab === 'consent' ? 'page' : undefined}
          >
            Consent History
          </button>
        </nav>

        {/* Right: Citizen Profile Dropdown */}
        <div className="header-right">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
};
