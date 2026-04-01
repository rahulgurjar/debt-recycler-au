import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ScenarioActions from './ScenarioActions';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ScenarioList({ refresh, userTier }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedScenario, setSelectedScenario] = useState(null);

  useEffect(() => {
    fetchScenarios();
  }, [refresh]);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const fetchScenarios = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/scenarios`, authHeader());
      setScenarios(response.data.scenarios || []);
    } catch (err) {
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/scenarios/${id}`, authHeader());
      setScenarios(scenarios.filter((s) => s.id !== id));
    } catch (err) {
      setError('Failed to delete scenario');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-AU');
  };

  if (loading && scenarios.length === 0) {
    return <div className="loading">Loading scenarios...</div>;
  }

  return (
    <div className="scenarios-container">
      <div className="scenarios-list">
        <h2>Saved Scenarios ({scenarios.length})</h2>

        {error && <div className="error-message">{error}</div>}

        {scenarios.length === 0 ? (
          <p className="no-scenarios">No scenarios saved yet. Create one on the Calculator tab!</p>
        ) : (
          <div className="table-responsive">
            <table className="scenarios-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Final Wealth</th>
                  <th>XIRR</th>
                  <th>Actions</th>
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
                    <td>{formatDate(scenario.created_at)}</td>
                    <td>{formatCurrency(scenario.final_wealth)}</td>
                    <td>{formatPercent(scenario.xirr)}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(scenario.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedScenario && (
        <div className="scenario-detail">
          <div className="detail-grid">
            <div className="detail-item">
              <span>Final Wealth:</span>
              <strong>{formatCurrency(selectedScenario.final_wealth)}</strong>
            </div>
            <div className="detail-item">
              <span>XIRR:</span>
              <strong>{formatPercent(selectedScenario.xirr)}</strong>
            </div>
            <div className="detail-item">
              <span>Initial Outlay:</span>
              <strong>{formatCurrency(selectedScenario.initial_outlay)}</strong>
            </div>
            <div className="detail-item">
              <span>Gearing Ratio:</span>
              <strong>{formatPercent(selectedScenario.gearing_ratio)}</strong>
            </div>
            <div className="detail-item">
              <span>Annual Investment:</span>
              <strong>{formatCurrency(selectedScenario.annual_investment)}</strong>
            </div>
            <div className="detail-item">
              <span>LOC Rate:</span>
              <strong>{formatPercent(selectedScenario.loc_interest_rate)}</strong>
            </div>
            <div className="detail-item">
              <span>Dividend Rate:</span>
              <strong>{formatPercent(selectedScenario.etf_dividend_rate)}</strong>
            </div>
            <div className="detail-item">
              <span>Capital Appreciation:</span>
              <strong>{formatPercent(selectedScenario.etf_capital_appreciation)}</strong>
            </div>
          </div>
          <ScenarioActions scenario={selectedScenario} userTier={userTier || 'starter'} />
          <button
            className="delete-btn"
            onClick={() => {
              handleDelete(selectedScenario.id);
              setSelectedScenario(null);
            }}
          >
            Delete Scenario
          </button>
        </div>
      )}
    </div>
  );
}

export default ScenarioList;
