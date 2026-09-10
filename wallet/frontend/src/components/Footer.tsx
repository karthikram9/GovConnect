import React from 'react';
import { PROTOTYPE_DISCLAIMER } from '../lib/constants';

export const Footer: React.FC = () => {
  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-links-row">
          <span className="footer-brand">GovConnect Citizen Credential Wallet</span>
          <span className="footer-divider">&bull;</span>
          <span>Decentralized Verifiable Credential Architecture</span>
          <span className="footer-divider">&bull;</span>
          <span>Government of Maharashtra (Simulated Prototype)</span>
        </div>
        <p className="footer-disclaimer">
          {PROTOTYPE_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
};
