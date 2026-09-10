import React from 'react';
import { Header } from '../components/Header';
import { TricolorStrip } from '../components/TricolorStrip';
import { Footer } from '../components/Footer';
import { PROTOTYPE_DISCLAIMER } from '../lib/constants';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab = 'home',
  onTabChange
}) => {
  return (
    <div className="app-shell">
      {/* Institutional Top Header with Profile Dropdown & Navigation */}
      <Header activeTab={activeTab} onTabChange={onTabChange} />

      {/* Mandatory 4px Saffron / White / Green Tricolor Strip */}
      <TricolorStrip />

      {/* Prototype Advisory Banner */}
      <div className="prototype-banner" role="status" aria-label="Prototype Disclaimer">
        <div className="banner-inner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{PROTOTYPE_DISCLAIMER}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="container" id="main-content">
        {children}
      </main>

      {/* Institutional Footer */}
      <Footer />
    </div>
  );
};

export default AppLayout;
