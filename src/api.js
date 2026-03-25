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
const { saveScenario, getScenarios, getScenario, deleteScenario, healthCheck, createUser, getUserByEmail, updateUserPassword, addResetToken, getAndVerifyResetToken } = require('./db');
const { validateEmail, validatePassword, hashPassword, comparePassword, generateToken, verifyToken, generateResetToken, RESET_TOKEN_EXPIRY } = require('./auth');

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
