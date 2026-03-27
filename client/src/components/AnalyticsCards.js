import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function AnalyticsCards() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API_URL}/admin/analytics`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setAnalytics(res.data);
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Admin access required to view analytics');
        } else {
          setError('Failed to load analytics');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div>Loading analytics...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="analytics-dashboard">
      <h2>Analytics</h2>

      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="card-label">Total Users</div>
          <div className="card-value">{analytics.total_users}</div>
        </div>
        <div className="analytics-card">
          <div className="card-label">Signups (7d)</div>
          <div className="card-value">{analytics.signups_7d}</div>
        </div>
        <div className="analytics-card">
          <div className="card-label">Signups (30d)</div>
          <div className="card-value">{analytics.signups_30d}</div>
        </div>
        <div className="analytics-card">
          <div className="card-label">MRR</div>
          <div className="card-value">{formatCurrency(analytics.mrr)}</div>
        </div>
        <div className="analytics-card">
          <div className="card-label">ARR</div>
          <div className="card-value">{formatCurrency(analytics.arr)}</div>
        </div>
      </div>

      <div className="tier-breakdown">
        <h3>Tier Breakdown</h3>
        <div className="tier-row">
          <span className="tier-label">Starter</span>
          <span className="tier-count">{analytics.tier_breakdown?.starter || 0}</span>
        </div>
        <div className="tier-row">
          <span className="tier-label">Professional</span>
          <span className="tier-count">{analytics.tier_breakdown?.professional || 0}</span>
        </div>
        <div className="tier-row">
          <span className="tier-label">Enterprise</span>
          <span className="tier-count">{analytics.tier_breakdown?.enterprise || 0}</span>
        </div>
      </div>

      {analytics.top_customers && analytics.top_customers.length > 0 && (
        <div className="top-customers">
          <h3>Top Customers</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {analytics.top_customers.map((c, i) => (
                <tr key={i}>
                  <td>{c.company_name}</td>
                  <td>{c.email}</td>
                  <td>{c.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AnalyticsCards;
