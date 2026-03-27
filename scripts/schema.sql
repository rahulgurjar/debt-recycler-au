-- Debt Recycler AU Database Schema
-- PostgreSQL tables for scenarios and projections

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'advisor',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reset_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  dob DATE,
  annual_income DECIMAL(12, 2),
  risk_profile VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenarios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  initial_outlay DECIMAL(10, 2) NOT NULL DEFAULT 55000,
  gearing_ratio DECIMAL(5, 4) NOT NULL DEFAULT 0.45,
  initial_loan DECIMAL(10, 2) NOT NULL DEFAULT 45000,
  annual_investment DECIMAL(10, 2) NOT NULL DEFAULT 25000,
  inflation DECIMAL(5, 4) NOT NULL DEFAULT 0.03,
  loc_interest_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.07,
  etf_dividend_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.03,
  etf_capital_appreciation DECIMAL(5, 4) NOT NULL DEFAULT 0.07,
  marginal_tax DECIMAL(5, 4) NOT NULL DEFAULT 0.47,
  final_wealth DECIMAL(15, 2),
  xirr DECIMAL(8, 6)
);

CREATE TABLE IF NOT EXISTS projections (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  date DATE NOT NULL,
  pf_value DECIMAL(15, 2) NOT NULL,
  loan DECIMAL(15, 2) NOT NULL,
  wealth DECIMAL(15, 2) NOT NULL,
  dividend DECIMAL(12, 2),
  loc_interest DECIMAL(12, 2),
  taxable_dividend DECIMAL(12, 2),
  after_tax_dividend DECIMAL(12, 2),
  pf_value_30_june DECIMAL(15, 2),
  wealth_30_june DECIMAL(15, 2),
  gearing DECIMAL(5, 4)
);

CREATE TABLE IF NOT EXISTS scenario_versions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
  parameters JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenario_reports (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  s3_url VARCHAR(512),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token);
CREATE INDEX IF NOT EXISTS idx_clients_customer ON clients(customer_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_projections_scenario ON projections(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_scenario ON scenario_versions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_created ON scenario_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_reports_scenario ON scenario_reports(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_reports_created ON scenario_reports(created_at DESC);
