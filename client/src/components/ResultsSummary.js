import React from 'react';

function ResultsSummary({ results }) {
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

  const finalYear = results.projection[results.projection.length - 1];

  return (
    <div className="results-summary">
      <h3>20-Year Results Summary</h3>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Final Wealth (Year 20)</div>
          <div className="summary-value">{formatCurrency(results.final_wealth)}</div>
          <div className="summary-detail">Net equity after liquidation</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">XIRR (Annual Return)</div>
          <div className="summary-value">{formatPercent(results.xirr)}</div>
          <div className="summary-detail">Internal rate of return</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">PF Value (Year 20)</div>
          <div className="summary-value">
            {formatCurrency(finalYear.pf_value_30_june)}
          </div>
          <div className="summary-detail">Total portfolio value</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Outstanding Loan (Year 20)</div>
          <div className="summary-value">{formatCurrency(finalYear.loan)}</div>
          <div className="summary-detail">Line of credit balance</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Gearing Ratio (Year 20)</div>
          <div className="summary-value">{formatPercent(finalYear.gearing)}</div>
          <div className="summary-detail">Loan / PF Value ratio</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Total Capital Invested</div>
          <div className="summary-value">
            {formatCurrency(
              results.parameters.initial_outlay +
                results.projection.reduce(
                  (sum, year) =>
                    sum +
                    (results.parameters.annual_investment *
                      Math.pow(1 + results.parameters.inflation, year.year)),
                  0
                )
            )}
          </div>
          <div className="summary-detail">Initial + all annual investments</div>
        </div>
      </div>

      <div className="parameters-display">
        <h4>Calculation Parameters</h4>
        <div className="params-grid">
          <div className="param">
            <span>Initial Outlay:</span>
            <strong>{formatCurrency(results.parameters.initial_outlay)}</strong>
          </div>
          <div className="param">
            <span>Initial Loan:</span>
            <strong>{formatCurrency(results.parameters.initial_loan)}</strong>
          </div>
          <div className="param">
            <span>Annual Investment:</span>
            <strong>{formatCurrency(results.parameters.annual_investment)}</strong>
          </div>
          <div className="param">
            <span>Inflation:</span>
            <strong>{formatPercent(results.parameters.inflation)}</strong>
          </div>
          <div className="param">
            <span>LOC Rate:</span>
            <strong>{formatPercent(results.parameters.loc_interest_rate)}</strong>
          </div>
          <div className="param">
            <span>Dividend Rate:</span>
            <strong>{formatPercent(results.parameters.etf_dividend_rate)}</strong>
          </div>
          <div className="param">
            <span>Capital Appreciation:</span>
            <strong>{formatPercent(results.parameters.etf_capital_appreciation)}</strong>
          </div>
          <div className="param">
            <span>Marginal Tax:</span>
            <strong>{formatPercent(results.parameters.marginal_tax)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResultsSummary;
