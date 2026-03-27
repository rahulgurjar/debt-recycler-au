const { newDb } = require('pg-mem');

const db = newDb();

db.public.none(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_name TEXT,
    role TEXT DEFAULT 'advisor',
    is_deleted INTEGER DEFAULT 0,
    first_name TEXT,
    last_name TEXT,
    stripe_customer_id TEXT,
    subscription_id TEXT,
    subscription_tier TEXT,
    subscription_status TEXT,
    current_period_end TIMESTAMPTZ,
    default_payment_method_id TEXT,
    monthly_scenarios_used INTEGER DEFAULT 0,
    monthly_clients_used INTEGER DEFAULT 0,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reset_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    dob DATE,
    annual_income NUMERIC,
    risk_profile TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    initial_outlay NUMERIC NOT NULL DEFAULT 55000,
    gearing_ratio NUMERIC NOT NULL DEFAULT 0.45,
    initial_loan NUMERIC NOT NULL DEFAULT 45000,
    annual_investment NUMERIC NOT NULL DEFAULT 25000,
    inflation NUMERIC NOT NULL DEFAULT 0.03,
    loc_interest_rate NUMERIC NOT NULL DEFAULT 0.07,
    etf_dividend_rate NUMERIC NOT NULL DEFAULT 0.03,
    etf_capital_appreciation NUMERIC NOT NULL DEFAULT 0.07,
    marginal_tax NUMERIC NOT NULL DEFAULT 0.47,
    final_wealth NUMERIC,
    xirr NUMERIC,
    investment_amount NUMERIC,
    loan_amount NUMERIC,
    expected_return NUMERIC,
    interest_rate NUMERIC,
    projection_years INTEGER DEFAULT 20,
    calculation_result TEXT
  );

  CREATE TABLE IF NOT EXISTS projections (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    date DATE,
    pf_value NUMERIC NOT NULL DEFAULT 0,
    loan NUMERIC NOT NULL DEFAULT 0,
    wealth NUMERIC NOT NULL DEFAULT 0,
    dividend NUMERIC,
    loc_interest NUMERIC,
    taxable_dividend NUMERIC,
    after_tax_dividend NUMERIC,
    pf_value_30_june NUMERIC,
    wealth_30_june NUMERIC,
    gearing NUMERIC
  );

  CREATE TABLE IF NOT EXISTS scenario_versions (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
    parameters TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS scenario_reports (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    s3_url TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
    client_email TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    tier TEXT DEFAULT 'starter',
    monthly_price NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS pg_indexes (
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    indexdef TEXT
  );

  INSERT INTO pg_indexes VALUES ('public', 'users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email)');
  INSERT INTO pg_indexes VALUES ('public', 'scenarios', 'idx_scenarios_user', 'CREATE INDEX idx_scenarios_user ON scenarios(user_id)');
  INSERT INTO pg_indexes VALUES ('public', 'projections', 'idx_projections_scenario', 'CREATE INDEX idx_projections_scenario ON projections(scenario_id)');
`);

const { Pool, Client } = db.adapters.createPg();

module.exports = { Pool, Client };
