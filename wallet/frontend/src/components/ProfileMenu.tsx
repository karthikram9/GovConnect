import React, { useState, useRef, useEffect } from 'react';

export const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="profile-menu-wrapper" ref={menuRef}>
      <button
        type="button"
        className="profile-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Demo Citizen Profile Options"
      >
        <span className="profile-avatar" aria-hidden="true">
          RP
        </span>
        <div className="profile-btn-text">
          <span className="profile-name">Ramesh K. Patil</span>
          <span className="profile-tag">Demo Citizen</span>
        </div>
        <svg
          className={`chevron-icon ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="profile-dropdown" role="menu">
          <div className="dropdown-header">
            <p className="dropdown-title">Demo Identity Profile</p>
            <p className="dropdown-identifier">
              Holder ID: <code>demo-wallet-user</code>
            </p>
          </div>

          <div className="dropdown-body">
            <div className="dropdown-item">
              <span className="item-label">Full Name</span>
              <span className="item-value">Ramesh Kumar Patil</span>
            </div>
            <div className="dropdown-item">
              <span className="item-label">Date of Birth</span>
              <span className="item-value">12 Apr 1988</span>
            </div>
            <div className="dropdown-item">
              <span className="item-label">Data Custody</span>
              <span className="item-value" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                Edge-Held (Client Device)
              </span>
            </div>
          </div>

          <div className="dropdown-notice">
            <p>
              <strong>Notice:</strong> This is an application-level prototype profile.
              Possession does not represent legal identity proof, Aadhaar authentication, or statutory e-KYC.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
