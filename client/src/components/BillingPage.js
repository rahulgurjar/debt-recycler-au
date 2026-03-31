import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const PLANS = [
  {
    tier: 'starter',
    label: 'Starter',
    price: '$0/mo',
    features: ['5 clients', '10 scenarios/month', 'PDF reports', 'Email support'],
  },
  {
    tier: 'professional',
    label: 'Professional',
    price: '$99/mo',
    features: ['50 clients', '100 scenarios/month', 'PDF reports', 'Excel export', 'Priority support'],
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    price: '$299/mo',
    features: ['Unlimited clients', 'Unlimited scenarios', 'PDF + Excel export', 'Bulk import', 'Dedicated support'],
  },
];

function BillingPage() {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTier, setSelectedTier] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const fetchWorkspace = async () => {
    try {
      const res = await axios.get(`${API_URL}/workspace`, authHeader());
      setWorkspace(res.data.workspace);
    } catch (err) {
      setError('Failed to load billing info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const handleUpgradeClick = (tier) => {
    setSelectedTier(tier);
    setPaymentMethod('');
    setUpgradeError('');
    setSuccessMsg('');
  };

  const handleConfirmUpgrade = async (e) => {
    e.preventDefault();
    setUpgradeError('');
    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/subscribe`,
        { tier: selectedTier, payment_method_id: paymentMethod },
        authHeader()
      );
      setSuccessMsg(`Successfully upgraded to ${selectedTier} plan`);
      setSelectedTier(null);
      setPaymentMethod('');
      await fetchWorkspace();
    } catch (err) {
      setUpgradeError(err.response?.data?.error || 'Upgrade failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading billing info...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const currentTier = workspace?.subscription_tier || 'starter';

  return (
    <div className="billing-page">
      <h2>Billing & Subscription</h2>
      <p className="current-tier-info">
        Current plan: <strong>{currentTier}</strong> ({workspace?.subscription_status || 'active'})
      </p>

      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="plans-grid">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={`plan-card ${plan.tier === currentTier ? 'plan-current' : ''}`}
          >
            <h3>{plan.label}</h3>
            <div className="plan-price">{plan.price}</div>
            <ul className="plan-features">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {plan.tier === currentTier ? (
              <span className="current-plan-badge">Current Plan</span>
            ) : (
              <button
                className="btn-primary"
                onClick={() => handleUpgradeClick(plan.tier)}
              >
                Upgrade to {plan.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {selectedTier && (
        <form className="upgrade-form" onSubmit={handleConfirmUpgrade}>
          <h3>Upgrade to {selectedTier}</h3>
          {upgradeError && <div className="error-message">{upgradeError}</div>}
          <div className="form-group">
            <label htmlFor="payment-method">Payment Method</label>
            <input
              id="payment-method"
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="pm_card_visa (Stripe payment method ID)"
              required
            />
            <small>Use Stripe test token: pm_card_visa for testing</small>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Processing...' : 'Confirm Upgrade'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setSelectedTier(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default BillingPage;
