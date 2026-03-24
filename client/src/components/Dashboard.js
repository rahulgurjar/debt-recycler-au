import React, { useState } from 'react';
import axios from 'axios';
import CalculatorForm from './CalculatorForm';
import ProjectionChart from './ProjectionChart';
import ResultsSummary from './ResultsSummary';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Dashboard({ onCalculationComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const handleCalculate = async (params) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/calculate`, params);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScenario = async (name) => {
    if (!results) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/scenarios`, {
        name,
        parameters: results.parameters,
      });
      onCalculationComplete();
      alert('Scenario saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save scenario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="calculator-panel">
          <h2>Scenario Parameters</h2>
          <CalculatorForm onCalculate={handleCalculate} loading={loading} />
        </div>

        {results && (
          <div className="results-panel">
            <ResultsSummary results={results} />
            <button
              className="save-btn"
              onClick={() => {
                const name = prompt('Enter scenario name:');
                if (name) handleSaveScenario(name);
              }}
              disabled={loading}
            >
              Save Scenario
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {results && (
        <div className="chart-panel">
          <h2>20-Year Projection</h2>
          <ProjectionChart data={results.projection} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
