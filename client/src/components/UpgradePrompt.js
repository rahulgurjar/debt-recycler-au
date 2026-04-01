import React from 'react';

function UpgradePrompt({ message, requiredTier, onUpgrade, onDismiss }) {
  return (
    <div className="upgrade-prompt">
      <div className="upgrade-prompt-icon">⬆</div>
      <div className="upgrade-prompt-content">
        {requiredTier && (
          <div className="required-tier-label">
            {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} plan required
          </div>
        )}
        <p className="upgrade-message">{message}</p>
        <p className="upgrade-teaser">
          Upgrade to <strong>Professional</strong> for unlimited scenarios, Excel export, and priority support.
        </p>
        <div className="upgrade-prompt-actions">
          <button className="btn-primary" onClick={onUpgrade}>
            Upgrade Plan
          </button>
          <button className="btn-secondary" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradePrompt;
