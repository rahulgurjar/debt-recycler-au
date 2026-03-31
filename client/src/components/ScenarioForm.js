import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import UpgradePrompt from './UpgradePrompt';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const DEFAULT_PARAMS = {
  name: '',
  client_id: '',
  initial_outlay: 55000,
  gearing_ratio: 0.45,
  initial_loan: 45000,
  annual_investment: 25000,
  inflation: 0.03,
  loc_interest_rate: 0.07,
  etf_dividend_rate: 0.03,
  etf_capital_appreciation: 0.07,
  marginal_tax: 0.47,
};

function ScenarioForm({ onScenarioCreated }) {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await axios.get(`${API_URL}/clients`, authHeader());
        setClients(res.data.clients || []);
      } catch (err) {
        setError('Failed to load clients');
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  const handleChange = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!params.client_id) {
      setError('Please select a client before running the scenario');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_URL}/scenarios`,
        { ...params, client_id: parseInt(params.client_id) },
        authHeader()
      );
      setResult(res.data);
      if (onScenarioCreated) onScenarioCreated();
    } catch (err) {
      if (err.response?.status === 402) {
        setShowUpgrade(true);
      } else {
        setError(err.response?.data?.error || 'Failed to create scenario');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);

  if (loadingClients) return <div>Loading clients...</div>;

  return (
    <div className="scenario-form-container">
      <h2>Create Scenario</h2>

      {showUpgrade && (
        <UpgradePrompt
          message="Monthly scenario limit reached. Upgrade to create more scenarios."
          onUpgrade={() => { setShowUpgrade(false); if (onScenarioCreated) onScenarioCreated('billing'); }}
          onDismiss={() => setShowUpgrade(false)}
        />
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="scenario-form">
        <div className="form-group">
          <label htmlFor="sf-client">Client</label>
          <select
            id="sf-client"
            value={params.client_id}
            onChange={(e) => handleChange('client_id', e.target.value)}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="sf-name">Scenario Name</label>
          <input
            id="sf-name"
            type="text"
            value={params.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Conservative 20-Year Plan"
            required
          />
        </div>

        <div className="params-grid">
          <div className="form-group">
            <label htmlFor="sf-outlay">Initial Outlay ($)</label>
            <input
              id="sf-outlay"
              type="number"
              value={params.initial_outlay}
              onChange={(e) => handleChange('initial_outlay', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-gearing">Gearing Ratio (0–1)</label>
            <input
              id="sf-gearing"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={params.gearing_ratio}
              onChange={(e) => handleChange('gearing_ratio', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-investment">Annual Investment ($)</label>
            <input
              id="sf-investment"
              type="number"
              value={params.annual_investment}
              onChange={(e) => handleChange('annual_investment', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-loc">LOC Interest Rate</label>
            <input
              id="sf-loc"
              type="number"
              step="0.001"
              value={params.loc_interest_rate}
              onChange={(e) => handleChange('loc_interest_rate', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-dividend">ETF Dividend Rate</label>
            <input
              id="sf-dividend"
              type="number"
              step="0.001"
              value={params.etf_dividend_rate}
              onChange={(e) => handleChange('etf_dividend_rate', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-growth">ETF Capital Growth</label>
            <input
              id="sf-growth"
              type="number"
              step="0.001"
              value={params.etf_capital_appreciation}
              onChange={(e) => handleChange('etf_capital_appreciation', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sf-tax">Marginal Tax Rate</label>
            <input
              id="sf-tax"
              type="number"
              step="0.01"
              value={params.marginal_tax}
              onChange={(e) => handleChange('marginal_tax', parseFloat(e.target.value))}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Running...' : 'Run Scenario'}
        </button>
      </form>

      {result && (
        <div className="scenario-results">
          <h3>Results: {result.scenario.name}</h3>
          <div className="results-summary">
            <div className="result-card">
              <span className="result-label">Final Wealth</span>
              <span className="result-value">{formatCurrency(result.scenario.final_wealth)}</span>
            </div>
            <div className="result-card">
              <span className="result-label">XIRR</span>
              <span className="result-value">{(result.scenario.xirr * 100).toFixed(2)}%</span>
            </div>
          </div>

          {result.projection && result.projection.length > 0 && (
            <div className="projection-chart">
              <h4>20-Year Projection</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={result.projection}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Legend />
                  <Line type="monotone" dataKey="wealth" stroke="#2563eb" name="Net Wealth" dot={false} />
                  <Line type="monotone" dataKey="pf_value" stroke="#16a34a" name="Portfolio" dot={false} />
                  <Line type="monotone" dataKey="loan" stroke="#dc2626" name="Loan" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScenarioForm;
