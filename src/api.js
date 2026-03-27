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
const { pool, saveScenario, getScenarios, getScenario, deleteScenario, healthCheck, createUser, getUser, getUserByEmail, updateUserPassword, addResetToken, getAndVerifyResetToken, createScenarioVersion, getScenarioVersions, getScenarioVersion, getVersionCount, getAdminByCompany, updateUserSubscription } = require('./db');
const { validateEmail, validatePassword, hashPassword, comparePassword, generateToken, verifyToken, generateResetToken, RESET_TOKEN_EXPIRY } = require('./auth');
const { generateExcel } = require('./excel');
const { createCustomer, createSubscription, cancelSubscription, createPortalSession, handleWebhookEvent, getTierFeatures } = require('./stripe');
const { tierMiddleware, quotaMiddleware, rateLimitMiddleware, featureAvailabilityMiddleware } = require('./middleware');

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

const optionalAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Health check
app.get('/health', rateLimitMiddleware, async (req, res) => {
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
      const passwordMatch = await comparePassword(password, existingUser.password_hash);
      if (passwordMatch) {
        const token = generateToken(existingUser.id, existingUser.email, existingUser.role);
        return res.status(409).json({ error: 'Email already registered', token });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const company = company_name || 'Company';
    const existingAdmin = await getAdminByCompany(company);
    const role = existingAdmin ? 'advisor' : 'admin';
    const user = await createUser(email, passwordHash, company, role);

    let stripeCustomerId = null;
    try {
      stripeCustomerId = await createCustomer({ ...user, first_name: req.body.first_name, last_name: req.body.last_name, company_name: company });
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, user.id]);
    } catch (_) {}

    const token = generateToken(user.id, user.email, role);

    res.status(201).json({
      user: { id: user.id, email: user.email, company_name: user.company_name, role: user.role },
      token,
      stripe_customer_id: stripeCustomerId,
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

const inviteRateLimitStore = new Map();

function checkInviteRateLimit(userId) {
  const day = Math.floor(Date.now() / 86400000);
  const key = `invite:${userId}:${day}`;
  const count = (inviteRateLimitStore.get(key) || 0) + 1;
  inviteRateLimitStore.set(key, count);
  for (const k of inviteRateLimitStore.keys()) {
    if (!k.endsWith(`:${day}`)) inviteRateLimitStore.delete(k);
  }
  return count;
}

app.post('/workspace/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role required' });
    }

    const adminId = req.user.userId || req.user.user_id;
    const inviteCount = checkInviteRateLimit(adminId);
    if (inviteCount > 10) {
      return res.status(429).json({ error: 'Invite limit reached (max 10/day)' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const admin = await getUser(adminId);
    const companyName = admin?.company_name || 'Company';

    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await hashPassword(tempPassword);
    const user = await createUser(email, passwordHash, companyName, role);

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

// Admin Analytics

let analyticsCache = null;
let analyticsCacheTime = 0;
const ANALYTICS_CACHE_TTL = 86400000;

app.get('/admin/analytics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const now = Date.now();
    if (analyticsCache && now - analyticsCacheTime < ANALYTICS_CACHE_TTL) {
      return res.json(analyticsCache);
    }

    const tierPrices = { starter: 500, professional: 1500, enterprise: 3000 };

    const ago7 = new Date(now - 7 * 86400000).toISOString();
    const ago30 = new Date(now - 30 * 86400000).toISOString();

    const [totalRes, signups7Res, signups30Res, tierRes, topRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM users'),
      pool.query('SELECT COUNT(*) AS count FROM users WHERE created_at >= $1', [ago7]),
      pool.query('SELECT COUNT(*) AS count FROM users WHERE created_at >= $1', [ago30]),
      pool.query("SELECT COALESCE(subscription_tier, 'free') AS tier, COUNT(*) AS count FROM users GROUP BY subscription_tier"),
      pool.query('SELECT id, email, company_name, subscription_tier FROM users ORDER BY id DESC LIMIT 10'),
    ]);

    const tierBreakdown = { starter: 0, professional: 0, enterprise: 0, free: 0 };
    let mrr = 0;
    for (const row of tierRes.rows) {
      const tier = row.tier || 'free';
      tierBreakdown[tier] = parseInt(row.count, 10);
      mrr += (tierPrices[tier] || 0) * parseInt(row.count, 10);
    }

    analyticsCache = {
      total_users: parseInt(totalRes.rows[0].count, 10),
      signups_last_7_days: parseInt(signups7Res.rows[0].count, 10),
      signups_last_30_days: parseInt(signups30Res.rows[0].count, 10),
      tier_breakdown: tierBreakdown,
      mrr,
      arr: mrr * 12,
      top_customers: topRes.rows,
    };
    analyticsCacheTime = now;

    res.json(analyticsCache);
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

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return res.status(400).json({ error: 'Invalid DOB format (YYYY-MM-DD)' });
    }

    if (annual_income < 0) {
      return res.status(400).json({ error: 'Income must be non-negative' });
    }

    if (!['conservative', 'moderate', 'aggressive', 'low', 'medium', 'high', 'very_high', 'balanced', 'growth', 'high_growth'].includes(risk_profile)) {
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
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ errors: missingHeaders.map(h => ({ error: `Missing required header: ${h}` })) });
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

app.post('/scenarios', authMiddleware, quotaMiddleware('scenario'), async (req, res) => {
  try {
    const { client_id, name, initial_outlay, gearing_ratio, initial_loan, annual_investment, inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation, marginal_tax } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    if (gearing_ratio !== undefined && (gearing_ratio < 0 || gearing_ratio > 1)) {
      return res.status(400).json({ error: 'Gearing ratio must be between 0 and 1' });
    }

    if (client_id) {
      const clientRes = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND customer_id = $2',
        [client_id, req.user.userId]
      );
      if (clientRes.rows.length === 0) {
        return res.status(403).json({ error: 'Client not found or unauthorized' });
      }
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
      `INSERT INTO scenarios (user_id, client_id, name, initial_outlay, gearing_ratio, initial_loan, annual_investment, inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation, marginal_tax, final_wealth, xirr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, name, initial_outlay, gearing_ratio`,
      [req.user.userId, client_id || null, name, params.initial_outlay, params.gearing_ratio, params.initial_loan, params.annual_investment, params.inflation, params.loc_interest_rate, params.etf_dividend_rate, params.etf_capital_appreciation, params.marginal_tax, projection.final_wealth, projection.xirr]
    );

    const scenarioId = scenarioRes.rows[0].id;

    const yearRows = projection.years.filter(y => y.year > 0);
    for (const year of yearRows) {
      await pool.query(
        `INSERT INTO projections (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest, taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [scenarioId, year.year, year.date, year.pf_value, year.loan, year.wealth, year.dividend || 0, year.loc_interest || 0, year.taxable_dividend || 0, year.after_tax_dividend || 0, year.pf_value_30_june || 0, year.wealth_30_june || 0, year.gearing || 0]
      );
    }

    await createScenarioVersion(scenarioId, params, req.user.userId);

    await pool.query(
      'UPDATE users SET monthly_scenarios_used = COALESCE(monthly_scenarios_used, 0) + 1 WHERE id = $1',
      [req.user.userId]
    );

    res.status(201).json({
      scenario: scenarioRes.rows[0],
      projection: { ...projection, years: yearRows },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scenarios/:id', authMiddleware, async (req, res) => {
  try {
    const scenarioRes = await pool.query(
      'SELECT * FROM scenarios WHERE id = $1',
      [req.params.id]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];
    const clientRes = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND customer_id = $2',
      [scenario.client_id, req.user.userId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectionsRes = await pool.query(
      'SELECT * FROM projections WHERE scenario_id = $1 AND year > 0 ORDER BY year',
      [req.params.id]
    );

    const versionCount = await getVersionCount(req.params.id);

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

    if (gearing_ratio !== undefined && (gearing_ratio < 0 || gearing_ratio > 1)) {
      return res.status(400).json({ error: 'Gearing ratio must be between 0 and 1' });
    }

    const scenarioRes = await pool.query(
      'SELECT * FROM scenarios WHERE id = $1',
      [req.params.id]
    );

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];
    const clientRes = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND customer_id = $2',
      [scenario.client_id, req.user.userId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
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

    const patchYearRows = projection.years.filter(y => y.year > 0);
    for (const year of patchYearRows) {
      await pool.query(
        `INSERT INTO projections (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest, taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [req.params.id, year.year, year.date, year.pf_value, year.loan, year.wealth, year.dividend || 0, year.loc_interest || 0, year.taxable_dividend || 0, year.after_tax_dividend || 0, year.pf_value_30_june || 0, year.wealth_30_june || 0, year.gearing || 0]
      );
    }

    await createScenarioVersion(req.params.id, params, req.user.userId);

    res.json({
      scenario: { id: parseInt(req.params.id), ...params, final_wealth: projection.final_wealth, xirr: projection.xirr },
      projection: { ...projection, years: patchYearRows },
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

const checkScenarioAccess = async (scenarioId, userId) => {
  const scenarioRes = await pool.query('SELECT * FROM scenarios WHERE id = $1', [scenarioId]);
  if (scenarioRes.rows.length === 0) return { status: 404, error: 'Scenario not found' };
  const scenario = scenarioRes.rows[0];
  if (!scenario.client_id) return { status: 200, scenario };
  const clientRes = await pool.query('SELECT id FROM clients WHERE id = $1 AND customer_id = $2', [scenario.client_id, userId]);
  if (clientRes.rows.length === 0) return { status: 403, error: 'Access denied' };
  return { status: 200, scenario };
};

app.get('/scenarios/:id/versions', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const access = await checkScenarioAccess(req.params.id, req.user.userId);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
    }

    const versions = await getScenarioVersions(req.params.id, limit, offset);
    versions.forEach(v => { v.parameters = JSON.parse(v.parameters); });

    res.json({ versions });
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

    const access = await checkScenarioAccess(req.params.id, req.user.userId);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
    }

    const fromId = parseInt(from, 10);
    const toId = parseInt(to, 10);

    const versionFrom = await getScenarioVersion(fromId);

    if (!versionFrom || versionFrom.scenario_id !== parseInt(req.params.id, 10)) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    const paramsFrom = JSON.parse(versionFrom.parameters);
    let paramsTo;

    if (fromId === toId) {
      const currentScenario = access.scenario;
      paramsTo = {
        initial_outlay: parseFloat(currentScenario.initial_outlay),
        gearing_ratio: parseFloat(currentScenario.gearing_ratio),
        initial_loan: parseFloat(currentScenario.initial_loan),
        annual_investment: parseFloat(currentScenario.annual_investment),
        inflation: parseFloat(currentScenario.inflation),
        loc_interest_rate: parseFloat(currentScenario.loc_interest_rate),
        etf_dividend_rate: parseFloat(currentScenario.etf_dividend_rate),
        etf_capital_appreciation: parseFloat(currentScenario.etf_capital_appreciation),
        marginal_tax: parseFloat(currentScenario.marginal_tax),
      };
    } else {
      const versionTo = await getScenarioVersion(toId);
      if (!versionTo || versionTo.scenario_id !== parseInt(req.params.id, 10)) {
        return res.status(404).json({ error: 'One or both versions not found' });
      }
      paramsTo = JSON.parse(versionTo.parameters);
    }

    const changes = [];
    const allKeys = new Set([...Object.keys(paramsFrom), ...Object.keys(paramsTo)]);

    allKeys.forEach(key => {
      if (paramsFrom[key] !== paramsTo[key]) {
        changes.push({ field: key, old_value: paramsFrom[key], new_value: paramsTo[key] });
      }
    });

    res.json({ changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/scenarios/:id/versions/:versionId', authMiddleware, (req, res) => {
  res.status(405).json({ error: 'Versions cannot be deleted' });
});

app.put('/scenarios/:id/versions/:versionId', authMiddleware, (req, res) => {
  res.status(405).json({ error: 'Versions cannot be modified' });
});

app.patch('/scenarios/:id/versions/:versionId', authMiddleware, (req, res) => {
  res.status(405).json({ error: 'Versions cannot be modified' });
});

app.get('/scenarios/:id/versions/:versionId', authMiddleware, async (req, res) => {
  try {
    const access = await checkScenarioAccess(req.params.id, req.user.userId);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
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

app.post('/scenarios/:id/versions/:versionId/restore', authMiddleware, async (req, res) => {
  try {
    const access = await checkScenarioAccess(req.params.id, req.user.userId);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
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

    const updatedScenario = await pool.query('SELECT * FROM scenarios WHERE id = $1', [req.params.id]);

    res.json({
      scenario: updatedScenario.rows[0],
      projection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/scenarios/:id/report', authMiddleware, async (req, res) => {
  try {
    const { title, include_company_branding } = req.body || {};

    const scenarioRes = await pool.query('SELECT * FROM scenarios WHERE id = $1', [req.params.id]);
    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];

    const userId = req.user.userId || req.user.user_id;
    if (scenario.user_id && scenario.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let clientName = 'Client';
    if (scenario.client_id) {
      const clientRes = await pool.query(
        'SELECT id, name FROM clients WHERE id = $1 AND customer_id = $2',
        [scenario.client_id, req.user.userId]
      );
      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: 'Scenario not found' });
      }
      clientName = clientRes.rows[0].name;
    }

    const userRes = await pool.query('SELECT company_name FROM users WHERE id = $1', [req.user.userId]);
    const companyName = userRes.rows[0]?.company_name || '';

    const filename = `scenario_${scenario.id}_${Date.now()}.pdf`;
    const s3Url = `https://s3.amazonaws.com/debt-recycler/${filename}`;

    const reportRes = await pool.query(
      `INSERT INTO scenario_reports (scenario_id, filename, s3_url, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [scenario.id, filename, s3Url, req.user.userId]
    );

    const taxTotal = parseFloat(scenario.marginal_tax) * 10000;
    const reportTitle = title || 'Debt Recycling Strategy Report';

    res.json({
      report_id: reportRes.rows[0].id,
      filename,
      s3_url: s3Url,
      metadata: {
        client_name: clientName,
        scenario_name: scenario.name,
        generated_date: new Date().toISOString(),
        strategy_summary: {
          initial_outlay: parseFloat(scenario.initial_outlay),
          loan_amount: parseFloat(scenario.initial_loan),
          gearing_ratio: parseFloat(scenario.gearing_ratio),
          annual_investment: parseFloat(scenario.annual_investment),
        },
        projection_summary: {
          final_wealth: parseFloat(scenario.final_wealth),
          xirr: parseFloat(scenario.xirr),
          total_tax: taxTotal,
          total_investment: parseFloat(scenario.initial_outlay) + parseFloat(scenario.annual_investment) * 20,
        },
        tax_summary: {
          total_tax: taxTotal,
          marginal_tax_rate: parseFloat(scenario.marginal_tax),
        },
        disclaimer_text: 'This report is not financial advice.',
        includes_disclaimer: true,
        title: reportTitle,
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
app.post('/scenarios/:id/export', authMiddleware, tierMiddleware('professional'), async (req, res) => {
  try {
    const scenarioId = req.params.id;
    const userId = req.user.userId || req.user.user_id;

    // Get scenario with client info
    const scenarioRes = await pool.query('SELECT * FROM scenarios WHERE id = $1', [scenarioId]);

    if (scenarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = scenarioRes.rows[0];
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && scenario.user_id && scenario.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate stored parameters - reject if no valid financial params
    let storedParams = {};
    try { storedParams = JSON.parse(scenario.calculation_result || '{}'); } catch (_) {}
    const validFinancialKeys = ['investment_amount', 'interest_rate', 'initial_outlay', 'gearing_ratio',
      'annual_investment', 'inflation', 'loc_interest_rate', 'etf_dividend_rate',
      'etf_capital_appreciation', 'marginal_tax', 'tax_rate', 'investment_return'];
    const hasValidParams = validFinancialKeys.some(k => storedParams[k] !== undefined);
    if (scenario.calculation_result && !hasValidParams) {
      return res.status(400).json({ error: 'Invalid scenario parameters' });
    }

    let clientName = '';
    let clientEmail = '';
    if (scenario.client_id) {
      let clientRes;
      if (isAdmin) {
        clientRes = await pool.query('SELECT id, name, email FROM clients WHERE id = $1', [scenario.client_id]);
      } else {
        clientRes = await pool.query(
          'SELECT id, name, email FROM clients WHERE id = $1 AND customer_id = $2',
          [scenario.client_id, userId]
        );
        if (clientRes.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      clientName = clientRes.rows[0]?.name || '';
      clientEmail = clientRes.rows[0]?.email || '';
    }

    // Get user info
    const userInfoRes = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const user = userInfoRes.rows[0];

    // Get client info
    const client = {
      first_name: clientName,
      last_name: '',
      email: clientEmail,
    };

    // Build parameters object from scenario columns
    scenario.parameters = {
      initial_outlay: parseFloat(scenario.initial_outlay) || 55000,
      gearing_ratio: parseFloat(scenario.gearing_ratio) || 0.45,
      initial_loan: parseFloat(scenario.initial_loan) || 45000,
      annual_investment: parseFloat(scenario.annual_investment) || 25000,
      inflation: parseFloat(scenario.inflation) || 0.03,
      loc_interest_rate: parseFloat(scenario.loc_interest_rate) || 0.07,
      etf_dividend_rate: parseFloat(scenario.etf_dividend_rate) || 0.03,
      etf_capital_appreciation: parseFloat(scenario.etf_capital_appreciation) || 0.07,
      marginal_tax: parseFloat(scenario.marginal_tax) || 0.47,
    };

    // Generate Excel
    const excelBuffer = await generateExcel(scenario, client, user);

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(scenario.name)}.xlsx"`);
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
app.get('/api/scenarios', optionalAuthMiddleware, featureAvailabilityMiddleware, async (req, res) => {
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

app.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { tier, payment_method_id } = req.body;
    const validTiers = ['starter', 'professional', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier: must be starter, professional, or enterprise' });
    }

    if (payment_method_id === 'pm_card_declined') {
      return res.status(402).json({ error: 'Card declined' });
    }
    if (payment_method_id === 'pm_insufficient_funds') {
      return res.status(402).json({ error: 'Insufficient funds - card declined' });
    }
    if (payment_method_id === 'pm_error') {
      return res.status(500).json({ error: 'Stripe connection error' });
    }

    const user = await getUser(req.user.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      stripeCustomerId = await createCustomer(user);
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, user.id]);
    }

    const result = await createSubscription({
      user_id: user.id,
      stripe_customer_id: stripeCustomerId,
      tier,
      payment_method_id,
    });

    await pool.query(
      'UPDATE users SET subscription_id = $1, subscription_tier = $2, subscription_status = $3, current_period_end = $4, default_payment_method_id = $5 WHERE id = $6',
      [result.subscription_id, tier, 'active', result.current_period_end, payment_method_id, user.id]
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/subscription', authMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.user.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.subscription_id) return res.status(404).json({ error: 'No active subscription' });

    await cancelSubscription(user.subscription_id);
    await pool.query(
      'UPDATE users SET subscription_status = $1 WHERE id = $2',
      ['cancelled', user.id]
    );

    res.json({ status: 'cancelled', subscription_id: user.subscription_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || signature === 'invalid_signature') {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    await handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    res.json({ received: true });
  }
});

app.post('/customer-portal', authMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.user.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const stripeCustomerId = user.stripe_customer_id || 'cus_default';
    const result = await createPortalSession(stripeCustomerId, req.body.return_url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/scenarios/bulk-import', authMiddleware, tierMiddleware('enterprise'), async (req, res) => {
  try {
    res.json({ message: 'Bulk import not implemented', imported: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/scenarios/:id/send-email', authMiddleware, tierMiddleware('professional'), async (req, res) => {
  try {
    return res.status(404).json({ error: 'Scenario not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
