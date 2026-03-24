import React, { useState } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import ScenarioList from './components/ScenarioList';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [scenarios, setScenarios] = useState([]);
  const [refreshScenarios, setRefreshScenarios] = useState(false);

  const handleCalculationComplete = () => {
    setRefreshScenarios(!refreshScenarios);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Debt Recycling Calculator</h1>
        <p>20-Year Wealth Projection for Australian Investors</p>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
        >
          Calculator
        </button>
        <button
          className={`nav-btn ${activeTab === 'scenarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenarios')}
        >
          Saved Scenarios
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'calculator' && (
          <Dashboard onCalculationComplete={handleCalculationComplete} />
        )}
        {activeTab === 'scenarios' && (
          <ScenarioList refresh={refreshScenarios} />
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Debt Recycler AU | Powered by React + Node.js</p>
      </footer>
    </div>
  );
}

export default App;
