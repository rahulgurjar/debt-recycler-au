import React, { useState } from 'react';

function CalculatorForm({ onCalculate, loading }) {
  const [params, setParams] = useState({
    initial_outlay: 55000,
    gearing_ratio: 0.45,
    initial_loan: 45000,
    annual_investment: 25000,
    inflation: 0.03,
    loc_interest_rate: 0.07,
    etf_dividend_rate: 0.03,
    etf_capital_appreciation: 0.07,
    marginal_tax: 0.47,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setParams((prev) => ({
      ...prev,
      [name]: parseFloat(value),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(params);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <form onSubmit={handleSubmit} className="calculator-form">
      <div className="form-section">
        <h3>Initial Investment</h3>
        <div className="form-group">
          <label>Initial Outlay</label>
          <input
            type="number"
            name="initial_outlay"
            value={params.initial_outlay}
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatCurrency(params.initial_outlay)}</span>
        </div>
        <div className="form-group">
          <label>Initial Loan (Line of Credit)</label>
          <input
            type="number"
            name="initial_loan"
            value={params.initial_loan}
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatCurrency(params.initial_loan)}</span>
        </div>
      </div>

      <div className="form-section">
        <h3>Annual Investment</h3>
        <div className="form-group">
          <label>Annual Investment (Base)</label>
          <input
            type="number"
            name="annual_investment"
            value={params.annual_investment}
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatCurrency(params.annual_investment)}</span>
        </div>
        <div className="form-group">
          <label>Inflation Rate</label>
          <input
            type="number"
            name="inflation"
            value={params.inflation}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.inflation)}</span>
        </div>
      </div>

      <div className="form-section">
        <h3>Debt & Returns</h3>
        <div className="form-group">
          <label>Gearing Ratio</label>
          <input
            type="number"
            name="gearing_ratio"
            value={params.gearing_ratio}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.gearing_ratio)}</span>
        </div>
        <div className="form-group">
          <label>LOC Interest Rate</label>
          <input
            type="number"
            name="loc_interest_rate"
            value={params.loc_interest_rate}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.loc_interest_rate)}</span>
        </div>
      </div>

      <div className="form-section">
        <h3>ETF Performance</h3>
        <div className="form-group">
          <label>Dividend Rate</label>
          <input
            type="number"
            name="etf_dividend_rate"
            value={params.etf_dividend_rate}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.etf_dividend_rate)}</span>
        </div>
        <div className="form-group">
          <label>Capital Appreciation</label>
          <input
            type="number"
            name="etf_capital_appreciation"
            value={params.etf_capital_appreciation}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.etf_capital_appreciation)}</span>
        </div>
      </div>

      <div className="form-section">
        <h3>Tax</h3>
        <div className="form-group">
          <label>Marginal Tax Rate</label>
          <input
            type="number"
            name="marginal_tax"
            value={params.marginal_tax}
            step="0.01"
            onChange={handleChange}
            disabled={loading}
          />
          <span className="help-text">{formatPercent(params.marginal_tax)}</span>
        </div>
      </div>

      <button type="submit" disabled={loading} className="submit-btn">
        {loading ? 'Calculating...' : 'Calculate Projection'}
      </button>
    </form>
  );
}

export default CalculatorForm;
