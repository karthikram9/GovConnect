import React from 'react';

interface QuickActionProps {
  title: string;
  description: string;
  badgeText?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  badgeText,
  icon,
  onClick
}) => {
  return (
    <button
      type="button"
      className="quick-action-card"
      onClick={onClick}
      aria-label={`${title} — ${description}`}
    >
      <div className="action-icon-circle">
        {icon}
      </div>
      <div className="action-text-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span className="action-card-title">{title}</span>
          {badgeText && <span className="action-card-badge">{badgeText}</span>}
        </div>
        <p className="action-card-desc">{description}</p>
      </div>
    </button>
  );
};
