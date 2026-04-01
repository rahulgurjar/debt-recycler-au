import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ClientPortal({ portalToken }) {
  const [client, setClient] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        const res = await axios.get(`${API_URL}/portal/scenarios?token=${portalToken}`);
        setClient(res.data.client);
        setScenarios(res.data.scenarios);
      } catch (err) {
        if (err.response?.status === 401) {
          setError('Invalid or expired portal link. Please contact your financial advisor for a new link.');
        } else {
          setError('Failed to load portal data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPortalData();
  }, [portalToken]);

  if (loading) {
    return (
      <div className="portal-loading">
        <p>Loading your financial scenarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-error">
        <h2>Unable to Access Portal</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="client-portal">
      <header className="portal-header">
        <h1>Debt Recycling Portal</h1>
        <p>Read-only view for {client?.name}</p>
      </header>

      <div className="portal-client-info">
        <h2>Welcome, {client?.name}</h2>
        <p className="portal-client-email">{client?.email}</p>
      </div>

      <div className="portal-content">
        <div className="portal-scenarios-list">
          <h3>Your Scenarios ({scenarios.length})</h3>
          {scenarios.length === 0 ? (
            <p className="portal-no-scenarios">No scenarios available yet. Your advisor will add scenarios for you.</p>
          ) : (
            <table className="portal-scenarios-table">
              <thead>
                <tr>
                  <th>Scenario Name</th>
                  <th>Initial Outlay</th>
                  <th>Annual Investment</th>
                  <th>Final Wealth</th>
                  <th>XIRR</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={selectedScenario?.id === scenario.id ? 'selected' : ''}
                  >
                    <td>{scenario.name}</td>
                    <td>{scenario.initial_outlay ? `$${Number(scenario.initial_outlay).toLocaleString()}` : '-'}</td>
                    <td>{scenario.annual_investment ? `$${Number(scenario.annual_investment).toLocaleString()}` : '-'}</td>
                    <td>{scenario.final_wealth ? `$${Number(scenario.final_wealth).toLocaleString()}` : '-'}</td>
                    <td>{scenario.xirr ? `${(Number(scenario.xirr) * 100).toFixed(2)}%` : '-'}</td>
                    <td>{new Date(scenario.created_at).toLocaleDateString('en-AU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedScenario && (
          <div className="portal-scenario-detail">
            <h3>{selectedScenario.name}</h3>
            <div className="portal-scenario-metrics">
              <div className="portal-metric">
                <span className="portal-metric-label">Initial Outlay</span>
                <span className="portal-metric-value">
                  {selectedScenario.initial_outlay ? `$${Number(selectedScenario.initial_outlay).toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="portal-metric">
                <span className="portal-metric-label">Gearing Ratio</span>
                <span className="portal-metric-value">
                  {selectedScenario.gearing_ratio ? `${(Number(selectedScenario.gearing_ratio) * 100).toFixed(0)}%` : '-'}
                </span>
              </div>
              <div className="portal-metric">
                <span className="portal-metric-label">Annual Investment</span>
                <span className="portal-metric-value">
                  {selectedScenario.annual_investment ? `$${Number(selectedScenario.annual_investment).toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="portal-metric">
                <span className="portal-metric-label">Final Wealth</span>
                <span className="portal-metric-value portal-metric-highlight">
                  {selectedScenario.final_wealth ? `$${Number(selectedScenario.final_wealth).toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="portal-metric">
                <span className="portal-metric-label">XIRR Return</span>
                <span className="portal-metric-value portal-metric-highlight">
                  {selectedScenario.xirr ? `${(Number(selectedScenario.xirr) * 100).toFixed(2)}%` : '-'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="portal-footer">
        <p>This is a read-only view. Contact your financial advisor for changes or questions.</p>
        <p>&copy; 2026 Debt Recycler AU</p>
      </footer>
    </div>
  );
}

export default ClientPortal;
