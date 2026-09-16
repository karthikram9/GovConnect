import React, { useState } from 'react';
import { loginOfficer, AuthUser } from '../services/api';

interface OfficerLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

export const OfficerLoginModal: React.FC<OfficerLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('dom_officer_01');
  const [password, setPassword] = useState('Password#2026!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await loginOfficer(username.trim(), password);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 50, 90, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            background: '#0B4F8A',
            color: '#FFFFFF',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 id="login-dialog-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Officer Authentication
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#B0BEC5', marginTop: '2px' }}>
              Domicile Certificate Office — Verifier Console
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '1.4rem',
                cursor: 'pointer',
                lineHeight: 1
              }}
              aria-label="Close"
            >
              &times;
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {errorMessage && (
            <div
              style={{
                background: '#FFEBEE',
                color: '#C62828',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                border: '1px solid #FFCDD2'
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="officer-username"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334E68', marginBottom: '0.4rem' }}
            >
              Operator Username
            </label>
            <input
              id="officer-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. dom_officer_01"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                border: '1px solid #D2DCE6',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="officer-password"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334E68', marginBottom: '0.4rem' }}
            >
              Password
            </label>
            <input
              id="officer-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                border: '1px solid #D2DCE6',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div
            style={{
              background: '#F0F4F8',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#486581',
              marginBottom: '1.25rem',
              border: '1px solid #D9E2EC'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Prototype Accounts:</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleQuickFill('dom_officer_01', 'Password#2026!')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #BCCCDC',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                Review Officer (<code>dom_officer_01</code>)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('dom_admin_01', 'AdminPassword#2026!')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #BCCCDC',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                Admin (<code>dom_admin_01</code>)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              fontSize: '0.92rem',
              fontWeight: 600,
              background: '#0B4F8A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Authenticating…' : 'Sign In to Verifier Console'}
          </button>
        </form>
      </div>
    </div>
  );
};
