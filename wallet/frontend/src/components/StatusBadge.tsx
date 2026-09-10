import React from 'react';

interface StatusBadgeProps {
  status: string;
  isOnline: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOnline }) => {
  return (
    <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};
