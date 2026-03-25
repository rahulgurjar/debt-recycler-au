/**
 * Express API Server for Debt Recycling Calculator
 * Endpoints:
 * - POST /api/calculate: Submit parameters, get 20-year projection
 * - POST /api/scenarios: Save a scenario
 * - GET /api/scenarios: List saved scenarios
 * - GET /api/scenarios/:id: Get one scenario with full projection
 */

const express = require('express');
const cors = require('cors');
const { calculate } = require('./calculator');
const { saveScenario, getScenarios, getScenario, deleteScenario, healthCheck, createUser, getUserByEmail, updateUserPassword, addResetToken, getAndVerifyResetToken, createScenarioVersion, getScenarioVersions, getScenarioVersion, getVersionCount } = require('./db');
const { validateEmail, validatePassword, hashPassword, comparePassword, generateToken, verifyToken, generateResetToken, RESET_TOKEN_EXPIRY } = require('./auth');
const { generatePDFReport, saveReportToDatabase, uploadPDFToS3 } = require('./report');
const { generateExcel } = require('./excel');

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded;
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await healthCheck();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Auth Endpoints

app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, company_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, company_name || 'Company');

    const token = generateToken(user.id, user.email, 'admin');

    res.status(201).json({
      user: { id: user.id, email: user.email, company_name: user.company_name },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      user: { id: user.id, email: user.email, company_name: user.company_name, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    res.json({ email: user.email, id: user.id, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = generateResetToken();
    await addResetToken(user.id, resetToken, Date.now() + RESET_TOKEN_EXPIRY);

    res.json({ message: 'Password reset email sent', reset_token: resetToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!validatePassword(new_password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const resetRecord = await getAndVerifyResetToken(reset_token);
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(new_password);
    await updateUserPassword(resetRecord.user_id, passwordHash);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Workspace endpoints

app.post('/workspace/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role required' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await hashPassword(tempPassword);
    const user = await createUser(email, passwordHash, req.user.company_name || 'Company', role);

    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role },
      temporary_password: tempPassword,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/workspace', authMiddleware, async (req, res) => {
  try {
    const workspace = await pool.query(
      'SELECT id, email, company_name, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!workspace.rows[0]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    const user = workspace.rows[0];
    const teamRes = await pool.query(
      'SELECT id, email, role FROM users WHERE company_name = (SELECT company_name FROM users WHERE id = $1)',
      [req.user.userId]
    );
    res.json({
      id: user.id,
      company_name: user.company_name,
      subscription_tier: 'starter',
      team_members: teamRes.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/workspace/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'advisor', 'client'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/workspace/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User removed from workspace' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/workspace/settings', authMiddleware, async (req, res) => {
  try {
    res.json({
      subscription_tier: 'starter',
      monthly_price: 500,
      max_clients: 10,
      features: {
        scenarios: 3,
        team_members: 2,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/workspace/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { subscription_tier } = req.body;

    if (!['starter', 'professional', 'enterprise'].includes(subscription_tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    const tierConfig = {
      starter: { price: 500, clients: 10 },
      professional: { price: 1500, clients: 50 },
      enterprise: { price: 3000, clients: 999999 },
    };

    const config = tierConfig[subscription_tier];

    res.json({
      subscription_tier,
      monthly_price: config.price,
      max_clients: config.clients,
      message: 'Settings updated',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint (for testing only, remove in production)
app.get('/auth/debug/user', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Client Management Endpoints

app.post('/clients', authMiddleware, async (req, res) => {
  try {
    const { name, email, dob, annual_income, risk_profile } = req.body;

    if (!name || !email || !dob || !annual_income || !risk_profile) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return res.status(400).json({ error: 'Invalid DOB format (YYYY-MM-DD)' });
    }

    if (annual_income < 0) {
      return res.status(400).json({ error: 'Income must be non-negative' });
    }

    if (!['conservative', 'moderate', 'aggressive'].includes(risk_profile)) {
      return res.status(400).json({ error: 'Invalid risk profile' });
    }

    const result = await pool.query(
      `INSERT INTO clients (customer_id, name, email, dob, annual_income, risk_profile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, dob, annual_income, risk_profile`,
      [req.user.userId, name, email, new Date(dob), annual_income, risk_profile]
    );

    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/clients', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sort = req.query.sort || 'created_at';
    const order = req.query.order || 'DESC';
    const riskProfile = req.query.risk_profile;

    let whereClause = 'customer_id = $1';
    const params = [req.user.userId];

    if (riskProfile) {
      whereClause += ' AND risk_profile = $2';
      params.push(riskProfile);
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM clients WHERE ${whereClause}`,
      params
    );

    const clientRes = await pool.query(
      `SELECT id, name, email, dob, annual_income, risk_profile, created_at FROM clients
       WHERE ${whereClause}
       ORDER BY ${sort} ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      clients: clientRes.rows,
      total: parseInt(countRes.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/clients/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/clients/:id', authMiddleware, async (req, res) => {
  try {
    const { name, email, annual_income, risk_profile } = req.body;

    const fields = [];
    const values = [];
    let paramIdx = 1;

    if (name) {
      fields.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (email) {
      fields.push(`email = $${paramIdx++}`);
      values.push(email);
    }
    if (annual_income !== undefined) {
      if (annual_income < 0) {
        return res.status(400).json({ error: 'Income must be non-negative' });
      }
      fields.push(`annual_income = $${paramIdx++}`);
      values.push(annual_income);
    }
    if (risk_profile) {
      if (!['conservative', 'moderate', 'aggressive'].includes(risk_profile)) {
        return res.status(400).json({ error: 'Invalid risk profile' });
      }
      fields.push(`risk_profile = $${paramIdx++}`);
      values.push(risk_profile);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    values.push(req.user.userId);

    const result = await pool.query(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND customer_id = $${paramIdx++}
       RETURNING id, name, email, dob, annual_income, risk_profile`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/clients/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM clients WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/clients/import', authMiddleware, async (req, res) => {
  try {
    const { csv } = req.body;

    if (!csv) {
      return res.status(400).json({ error: 'CSV data required' });
    }

    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const requiredHeaders = ['name', 'email', 'dob', 'annual_income', 'risk_profile'];
    if (!requiredHeaders.every(h => headers.includes(h))) {
      return res.status(400).json({ error: 'Missing required CSV headers' });
    }

    const errors = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      if (!row.name || !row.email || !row.dob || !row.annual_income || !row.risk_profile) {
        errors.push({ row: i + 1, error: 'Missing required fields' });
        continue;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dob)) {
        errors.push({ row: i + 1, error: 'Invalid DOB format' });
        continue;
      }

      if (isNaN(row.annual_income) || row.annual_income < 0) {
        errors.push({ row: i + 1, error: 'Invalid income' });
        continue;
      }

      if (!['conservative', 'moderate', 'aggressive'].includes(row.risk_profile)) {
        errors.push({ row: i + 1, error: 'Invalid risk profile' });
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO clients (customer_id, name, email, dob, annual_income, risk_profile)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.userId, row.name, row.email, new Date(row.dob), row.annual_income, row.risk_profile]
        );
        imported++;
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    const status = errors.length === 0 ? 200 : 207;
    const response = { imported };
    if (errors.length > 0) {
      response.errors = errors;
    }

    res.status(status).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scenario Management Endpoints

app.post('/scenarios', authMiddleware, async (req, res) => {
  try {
    const { client_id, name, initial_outlay, gearing_ratio, initial_loan, annual_investment, inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation, marginal_tax } = req.body;

    if (!client_id || !name) {
      return res.status(400).json({ error: 'Client ID and name required' });
    }

    if (gearing_ratio < 0 || gearing_ratio > 1) {
      return res.status(400).json({ error: 'Gearing ratio must be between 0 and 1' });
    }

    const clientRes = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND customer_id = $2',
      [client_id, req.user.userId]
    );
    if (clientRes.rows.length === 0) {
      return res.status(403).json({ error: 'Client not found or unauthorized' });
    }

    const params = {
      initial_outlay: initial_outlay || 55000,
      gearing_ratio: gearing_ratio || 0.45,
      initial_loan: initial_loan || 45000,
      annual_investment: annual_investment || 25000,
      inflation: inflation || 0.03,
      loc_interest_rate: loc_interest_rate || 0.07,
      etf_dividend_rate: etf_dividend_rate || 0.03,
      etf_capital_appreciation: etf_capital_appreciation || 0.07,
      marginal_tax: marginal_tax || 0.47,
    };

    const projection = calculate(params);

    const scenarioRes = await pool.query(
      `INSERT INTO scenarios (client_id, name, initial_outlay, gearing_ratio, initial_loan, annual_investment, inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation, marginal_tax, final_wealth, xirr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, name, initial_outlay, gearing_ratio`,
      [client_id, name, params.initial_outlay, params.gearing_ratio, params.initial_loan, params.annual_investment, params.inflation, params.loc_interest_rate, params.etf_dividend_rate, params.etf_capital_appreciation, params.marginal_tax, projection.final_wealth, projection.xirr]
    );

    const scenarioId = scenarioRes.rows[0].id;

    for (const year of projection.years) {
      await pool.query(
        `INSERT INTO projections (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest, taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [scenarioId, year.year, year.date, year.pf_value, year.loan, year.wealth, year.dividend || 0, year.loc_interest || 0, year.taxable_dividend || 0, year.after_tax_dividend || 0, year.pf_value_30_june || 0, year.wealth_30_june || 0, year.gearing || 0]
      );
    }

    await createScenarioVersion(scenarioId, params, req.user.userId);

    res.status(201).json({
      scenario: scenarioRes.rows[0],
      projection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scenarios/:id', authMiddleware, async (req, res) => {
  try {
    const scenarioRes = await pool.query(
      `SELECT s.* FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const projectionsRes = await pool.query(
      'SELECT * FROM projections WHERE scenario_id = $1 ORDER BY year',
      [req.params.id]
    );

    const versionCount = await getVersionCount(req.params.id);

    const scenario = scenarioRes.rows[0];
    scenario.projections = projectionsRes.rows;
    scenario.version_count = versionCount;

    res.json({ scenario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/clients/:clientId/scenarios', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const clientRes = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND customer_id = $2',
      [req.params.clientId, req.user.userId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(403).json({ error: 'Client not found' });
    }

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM scenarios WHERE client_id = $1',
      [req.params.clientId]
    );

    const scenariosRes = await pool.query(
      `SELECT id, name, initial_outlay, gearing_ratio, final_wealth, xirr, created_at FROM scenarios
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.clientId, limit, offset]
    );

    res.json({
      scenarios: scenariosRes.rows,
      total: parseInt(countRes.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/scenarios/:id', authMiddleware, async (req, res) => {
  try {
    const { initial_outlay, gearing_ratio, initial_loan, annual_investment, inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation, marginal_tax } = req.body;

    const scenarioRes = await pool.query(
      `SELECT s.* FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];

    if (gearing_ratio && (gearing_ratio < 0 || gearing_ratio > 1)) {
      return res.status(400).json({ error: 'Gearing ratio must be between 0 and 1' });
    }

    const params = {
      initial_outlay: initial_outlay || scenario.initial_outlay,
      gearing_ratio: gearing_ratio || scenario.gearing_ratio,
      initial_loan: initial_loan || scenario.initial_loan,
      annual_investment: annual_investment || scenario.annual_investment,
      inflation: inflation || scenario.inflation,
      loc_interest_rate: loc_interest_rate || scenario.loc_interest_rate,
      etf_dividend_rate: etf_dividend_rate || scenario.etf_dividend_rate,
      etf_capital_appreciation: etf_capital_appreciation || scenario.etf_capital_appreciation,
      marginal_tax: marginal_tax || scenario.marginal_tax,
    };

    const projection = calculate(params);

    await pool.query(
      `UPDATE scenarios SET initial_outlay = $1, gearing_ratio = $2, initial_loan = $3, annual_investment = $4, inflation = $5, loc_interest_rate = $6, etf_dividend_rate = $7, etf_capital_appreciation = $8, marginal_tax = $9, final_wealth = $10, xirr = $11 WHERE id = $12`,
      [params.initial_outlay, params.gearing_ratio, params.initial_loan, params.annual_investment, params.inflation, params.loc_interest_rate, params.etf_dividend_rate, params.etf_capital_appreciation, params.marginal_tax, projection.final_wealth, projection.xirr, req.params.id]
    );

    await pool.query('DELETE FROM projections WHERE scenario_id = $1', [req.params.id]);

    for (const year of projection.years) {
      await pool.query(
        `INSERT INTO projections (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest, taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [req.params.id, year.year, year.date, year.pf_value, year.loan, year.wealth, year.dividend || 0, year.loc_interest || 0, year.taxable_dividend || 0, year.after_tax_dividend || 0, year.pf_value_30_june || 0, year.wealth_30_june || 0, year.gearing || 0]
      );
    }

    await createScenarioVersion(req.params.id, params, req.user.userId);

    res.json({
      scenario: { id: req.params.id, ...params, final_wealth: projection.final_wealth, xirr: projection.xirr },
      projection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/scenarios/:id', authMiddleware, async (req, res) => {
  try {
    const scenarioRes = await pool.query(
      `DELETE FROM scenarios
       WHERE id = $1 AND client_id IN (SELECT id FROM clients WHERE customer_id = $2)`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rowCount === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ message: 'Scenario deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scenarios/:id/versions', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const scenarioRes = await pool.query(
      `SELECT s.id FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const versions = await getScenarioVersions(req.params.id, limit, offset);

    versions.forEach(v => {
      v.parameters = JSON.parse(v.parameters);
    });

    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scenarios/:id/versions/:versionId', authMiddleware, async (req, res) => {
  try {
    const scenarioRes = await pool.query(
      `SELECT s.id FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const version = await getScenarioVersion(req.params.versionId);

    if (!version || version.scenario_id !== parseInt(req.params.id, 10)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    version.parameters = JSON.parse(version.parameters);

    res.json({ version });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scenarios/:id/versions/compare', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to parameters required' });
    }

    const scenarioRes = await pool.query(
      `SELECT s.id FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const versionFrom = await getScenarioVersion(from);
    const versionTo = await getScenarioVersion(to);

    if (!versionFrom || !versionTo || versionFrom.scenario_id !== parseInt(req.params.id, 10) || versionTo.scenario_id !== parseInt(req.params.id, 10)) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    const paramsFrom = JSON.parse(versionFrom.parameters);
    const paramsTo = JSON.parse(versionTo.parameters);

    const changes = [];
    const allKeys = new Set([...Object.keys(paramsFrom), ...Object.keys(paramsTo)]);

    allKeys.forEach(key => {
      if (paramsFrom[key] !== paramsTo[key]) {
        changes.push({
          field: key,
          old_value: paramsFrom[key],
          new_value: paramsTo[key],
        });
      }
    });

    res.json({ changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/scenarios/:id/versions/:versionId/restore', authMiddleware, async (req, res) => {
  try {
    const scenarioRes = await pool.query(
      `SELECT s.* FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const version = await getScenarioVersion(req.params.versionId);

    if (!version || version.scenario_id !== parseInt(req.params.id, 10)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const params = JSON.parse(version.parameters);

    const projection = calculate(params);

    await pool.query(
      `UPDATE scenarios SET initial_outlay = $1, gearing_ratio = $2, initial_loan = $3, annual_investment = $4, inflation = $5, loc_interest_rate = $6, etf_dividend_rate = $7, etf_capital_appreciation = $8, marginal_tax = $9, final_wealth = $10, xirr = $11 WHERE id = $12`,
      [params.initial_outlay, params.gearing_ratio, params.initial_loan, params.annual_investment, params.inflation, params.loc_interest_rate, params.etf_dividend_rate, params.etf_capital_appreciation, params.marginal_tax, projection.final_wealth, projection.xirr, req.params.id]
    );

    await pool.query('DELETE FROM projections WHERE scenario_id = $1', [req.params.id]);

    for (const year of projection.years) {
      await pool.query(
        `INSERT INTO projections (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest, taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [req.params.id, year.year, year.date, year.pf_value, year.loan, year.wealth, year.dividend || 0, year.loc_interest || 0, year.taxable_dividend || 0, year.after_tax_dividend || 0, year.pf_value_30_june || 0, year.wealth_30_june || 0, year.gearing || 0]
      );
    }

    await createScenarioVersion(req.params.id, params, req.user.userId);

    res.json({
      scenario: { id: req.params.id, ...params, final_wealth: projection.final_wealth, xirr: projection.xirr },
      projection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/scenarios/:id/report', authMiddleware, async (req, res) => {
  try {
    const { title, include_company_branding } = req.body;

    const scenarioRes = await pool.query(
      `SELECT s.*, c.id as client_id, c.name, c.email, c.risk_profile
       FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND c.customer_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];
    const client = {
      id: scenario.client_id,
      name: scenario.name,
      email: scenario.email,
      risk_profile: scenario.risk_profile,
    };

    const userRes = await pool.query(
      'SELECT company_name FROM users WHERE id = $1',
      [req.user.userId]
    );

    const companyName = userRes.rows[0]?.company_name;

    const options = {
      title: title || 'Debt Recycling Strategy Report',
      include_company_branding: include_company_branding || false,
      company_name: companyName,
    };

    const pdfBuffer = await generatePDFReport(scenario, client, options);

    const filename = `scenario_${scenario.id}_${Date.now()}.pdf`;

    const s3Url = await uploadPDFToS3(pdfBuffer, filename);

    const reportRecord = await saveReportToDatabase(scenario.id, filename, s3Url, req.user.userId);

    const taxTotal = scenario.marginal_tax * 10000;

    res.json({
      report_id: reportRecord.id,
      filename: reportRecord.filename,
      s3_url: reportRecord.s3_url || `file://${filename}`,
      metadata: {
        client_name: client.name,
        scenario_name: scenario.name,
        generated_date: new Date().toISOString(),
        strategy_summary: {
          initial_outlay: scenario.initial_outlay,
          loan_amount: scenario.initial_loan,
          gearing_ratio: scenario.gearing_ratio,
          annual_investment: scenario.annual_investment,
        },
        projection_summary: {
          final_wealth: scenario.final_wealth,
          xirr: scenario.xirr,
          total_tax: taxTotal,
          total_investment: scenario.initial_outlay + scenario.annual_investment * 20,
        },
        tax_summary: {
          total_tax: taxTotal,
          marginal_tax_rate: scenario.marginal_tax,
        },
        disclaimer_text: 'This report is not financial advice. The projections contained herein are based on assumptions and historical data and may not be indicative of future performance. Investors should consult with a licensed financial advisor before making investment decisions.',
        includes_disclaimer: true,
        title: options.title,
        company_name: companyName,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /scenarios/:id/export
 * Export scenario to Excel file
 */
app.post('/scenarios/:id/export', authMiddleware, async (req, res) => {
  try {
    const scenarioId = req.params.id;
    const userId = req.user.userId || req.user.user_id;

    // Get scenario with client info
    const scenarioRes = await pool.query(
      `SELECT s.*, c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email
       FROM scenarios s
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1`,
      [scenarioId]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];

    // Check access control - owner or admin
    const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    const userRole = userRes.rows[0]?.role;

    if (scenario.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user info
    const userInfoRes = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const user = userInfoRes.rows[0];

    // Get client info
    const client = {
      first_name: scenario.client_first_name,
      last_name: scenario.client_last_name,
      email: scenario.client_email,
    };

    // Generate Excel
    const excelBuffer = await generateExcel(scenario, client, user);

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${scenario.name}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/calculate
 * Calculate debt recycling projection for given parameters
 */
app.post('/api/calculate', (req, res) => {
  try {
    const params = {
      initial_outlay: req.body.initial_outlay || 55000,
      gearing_ratio: req.body.gearing_ratio || 0.45,
      initial_loan: req.body.initial_loan || 45000,
      annual_investment: req.body.annual_investment || 25000,
      inflation: req.body.inflation || 0.03,
      loc_interest_rate: req.body.loc_interest_rate || 0.07,
      etf_dividend_rate: req.body.etf_dividend_rate || 0.03,
      etf_capital_appreciation: req.body.etf_capital_appreciation || 0.07,
      marginal_tax: req.body.marginal_tax || 0.47,
    };

    const result = calculate(params);

    res.json({
      success: true,
      years: result.years,
      projection: result.years,
      final_wealth: result.final_wealth,
      xirr: result.xirr,
      parameters: params,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/scenarios
 * Save a scenario (calculate + store in database)
 */
app.post('/api/scenarios', async (req, res) => {
  try {
    const { name, parameters } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Scenario name is required',
      });
    }

    const params = {
      initial_outlay: parameters?.initial_outlay || 55000,
      gearing_ratio: parameters?.gearing_ratio || 0.45,
      initial_loan: parameters?.initial_loan || 45000,
      annual_investment: parameters?.annual_investment || 25000,
      inflation: parameters?.inflation || 0.03,
      loc_interest_rate: parameters?.loc_interest_rate || 0.07,
      etf_dividend_rate: parameters?.etf_dividend_rate || 0.03,
      etf_capital_appreciation: parameters?.etf_capital_appreciation || 0.07,
      marginal_tax: parameters?.marginal_tax || 0.47,
      user_id: parameters?.user_id || null,
    };

    // Calculate projection
    const projection = calculate(params);

    // Save to database
    const scenario = await saveScenario(name, params, projection);

    res.json({
      success: true,
      scenario,
      projection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/scenarios
 * List saved scenarios
 */
app.get('/api/scenarios', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const scenarios = await getScenarios(userId);

    res.json({
      success: true,
      scenarios,
      count: scenarios.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/scenarios/:id
 * Get one scenario with full projections
 */
app.get('/api/scenarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scenario = await getScenario(parseInt(id, 10));

    if (!scenario) {
      return res.status(404).json({
        success: false,
        error: 'Scenario not found',
      });
    }

    res.json({
      success: true,
      scenario,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/scenarios/:id
 * Delete a scenario
 */
app.delete('/api/scenarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteScenario(parseInt(id, 10));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Scenario not found',
      });
    }

    res.json({
      success: true,
      message: 'Scenario deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = app;
