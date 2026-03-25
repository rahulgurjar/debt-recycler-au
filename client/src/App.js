import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ScenarioList from './components/ScenarioList';
import Tutorial from './components/Tutorial';
import Login from './components/Login';
import Signup from './components/Signup';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPage, setAuthPage] = useState('login');
  const [activeTab, setActiveTab] = useState('calculator');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveTab('calculator');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setAuthPage('login');
    setUser(null);
  };

  if (!isAuthenticated) {
    return (
      <>
        {authPage === 'login' ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToSignup={() => setAuthPage('signup')}
          />
        ) : (
          <Signup
            onSignupSuccess={handleLoginSuccess}
            onSwitchToLogin={() => setAuthPage('login')}
          />
        )}
      </>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Debt Recycling Dashboard</h1>
            <p>20-Year Wealth Projection for Australian Investors</p>
          </div>
          <div className="header-user">
            <span className="user-name">{user?.email}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
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
        <button
          className={`nav-btn ${activeTab === 'tutorial' ? 'active' : ''}`}
          onClick={() => setActiveTab('tutorial')}
        >
          Tutorial & Verification
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'calculator' && <Dashboard />}
        {activeTab === 'scenarios' && <ScenarioList />}
        {activeTab === 'tutorial' && <Tutorial />}
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Debt Recycler AU | Financial Advisor Tools for Australian Investors</p>
      </footer>
    </div>
  );
}

export default App;
