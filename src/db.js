/**
 * PostgreSQL Database Connection & Operations
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'debt_recycler',
  ssl: { rejectUnauthorized: false },
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Create a new scenario and save projection results
 */
async function saveScenario(name, params, projectionResults) {
  try {
    // Insert scenario
    const scenarioResult = await pool.query(
      `INSERT INTO scenarios
       (user_id, name, initial_outlay, gearing_ratio, initial_loan, annual_investment,
        inflation, loc_interest_rate, etf_dividend_rate, etf_capital_appreciation,
        marginal_tax, final_wealth, xirr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        params.user_id || null,
        name,
        params.initial_outlay,
        params.gearing_ratio,
        params.initial_loan,
        params.annual_investment,
        params.inflation,
        params.loc_interest_rate,
        params.etf_dividend_rate,
        params.etf_capital_appreciation,
        params.marginal_tax,
        projectionResults.final_wealth,
        projectionResults.xirr,
      ]
    );

    const scenarioId = scenarioResult.rows[0].id;

    // Insert projections
    for (const year of projectionResults.years) {
      await pool.query(
        `INSERT INTO projections
         (scenario_id, year, date, pf_value, loan, wealth, dividend, loc_interest,
          taxable_dividend, after_tax_dividend, pf_value_30_june, wealth_30_june, gearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          scenarioId,
          year.year,
          year.date,
          year.pf_value,
          year.loan,
          year.wealth,
          year.dividend || 0,
          year.loc_interest || 0,
          year.taxable_dividend || 0,
          year.after_tax_dividend || 0,
          year.pf_value_30_june || 0,
          year.wealth_30_june || 0,
          year.gearing || 0,
        ]
      );
    }

    return { id: scenarioId, name, ...params };
  } catch (error) {
    console.error('Error saving scenario:', error);
    throw error;
  }
}

/**
 * Get all scenarios for a user
 */
async function getScenarios(userId = null) {
  try {
    const query = userId
      ? 'SELECT * FROM scenarios WHERE user_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM scenarios ORDER BY created_at DESC LIMIT 50';

    const params = userId ? [userId] : [];
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    throw error;
  }
}

/**
 * Get a specific scenario with full projections
 */
async function getScenario(scenarioId) {
  try {
    const scenarioResult = await pool.query(
      'SELECT * FROM scenarios WHERE id = $1',
      [scenarioId]
    );

    if (scenarioResult.rows.length === 0) {
      return null;
    }

    const projectionResult = await pool.query(
      'SELECT * FROM projections WHERE scenario_id = $1 ORDER BY year',
      [scenarioId]
    );

    const scenario = scenarioResult.rows[0];
    scenario.projections = projectionResult.rows;
    return scenario;
  } catch (error) {
    console.error('Error fetching scenario:', error);
    throw error;
  }
}

/**
 * Delete a scenario (projections deleted via CASCADE)
 */
async function deleteScenario(scenarioId) {
  try {
    const result = await pool.query(
      'DELETE FROM scenarios WHERE id = $1',
      [scenarioId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting scenario:', error);
    throw error;
  }
}

/**
 * User Management Functions
 */

async function createUser(emailOrObj, passwordHash, companyName = 'Company', role = 'admin') {
  try {
    let email, hash, company, userRole, firstName, lastName, subscriptionTier, trialEndsAt;
    if (emailOrObj && typeof emailOrObj === 'object') {
      email = emailOrObj.email;
      hash = emailOrObj.password_hash;
      company = emailOrObj.company_name || 'Company';
      userRole = emailOrObj.role || 'advisor';
      firstName = emailOrObj.first_name || null;
      lastName = emailOrObj.last_name || null;
      subscriptionTier = 'subscription_tier' in emailOrObj ? emailOrObj.subscription_tier : (emailOrObj.trial_ends_at ? null : 'professional');
      trialEndsAt = emailOrObj.trial_ends_at || null;
    } else {
      email = emailOrObj;
      hash = passwordHash;
      company = companyName;
      userRole = role;
      firstName = null;
      lastName = null;
      subscriptionTier = null;
      trialEndsAt = null;
    }
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, company_name, role, first_name, last_name, subscription_tier, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, password_hash, company_name, role, first_name, last_name, subscription_tier, subscription_status, stripe_customer_id, current_period_end, default_payment_method_id, monthly_scenarios_used, trial_ends_at`,
      [email, hash, company, userRole, firstName, lastName, subscriptionTier, trialEndsAt]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

async function getUser(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
}

async function getUserByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

async function getAdminByCompany(companyName) {
  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE company_name = $1 AND role = 'admin' LIMIT 1",
      [companyName]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error checking company admin:', error);
    throw error;
  }
}

async function updateUserPassword(userId, passwordHash) {
  try {
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

async function addResetToken(userId, resetToken, expiryTime) {
  try {
    await pool.query(
      `INSERT INTO password_resets (user_id, reset_token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, resetToken, new Date(expiryTime)]
    );
  } catch (error) {
    console.error('Error adding reset token:', error);
    throw error;
  }
}

async function getAndVerifyResetToken(resetToken) {
  try {
    const result = await pool.query(
      `SELECT * FROM password_resets
       WHERE reset_token = $1 AND expires_at > NOW()`,
      [resetToken]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error verifying reset token:', error);
    throw error;
  }
}

/**
 * Scenario Versioning Functions
 */

async function createScenarioVersion(scenarioId, parameters, userId) {
  try {
    const result = await pool.query(
      `INSERT INTO scenario_versions (scenario_id, parameters, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, scenario_id, parameters, created_by, created_at`,
      [scenarioId, JSON.stringify(parameters), userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating scenario version:', error);
    throw error;
  }
}

async function getScenarioVersions(scenarioId, limit = 50, offset = 0) {
  try {
    const result = await pool.query(
      `SELECT id, scenario_id, parameters, created_by, created_at
       FROM scenario_versions
       WHERE scenario_id = $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [scenarioId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching scenario versions:', error);
    throw error;
  }
}

async function getScenarioVersion(versionId) {
  try {
    const result = await pool.query(
      `SELECT id, scenario_id, parameters, created_by, created_at
       FROM scenario_versions
       WHERE id = $1`,
      [versionId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching scenario version:', error);
    throw error;
  }
}

async function getVersionCount(scenarioId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM scenario_versions WHERE scenario_id = $1',
      [scenarioId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error getting version count:', error);
    throw error;
  }
}

/**
 * Subscription functions
 */
async function updateUserSubscription(userId, subscriptionData) {
  try {
    const result = await pool.query(
      `UPDATE users SET
        stripe_customer_id = $2,
        subscription_id = $3,
        subscription_tier = $4,
        subscription_status = $5,
        current_period_end = $6,
        default_payment_method_id = $7
       WHERE id = $1
       RETURNING stripe_customer_id, subscription_id, subscription_tier, subscription_status`,
      [
        userId,
        subscriptionData.stripe_customer_id,
        subscriptionData.subscription_id,
        subscriptionData.subscription_tier,
        subscriptionData.subscription_status,
        subscriptionData.current_period_end,
        subscriptionData.default_payment_method_id,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
}

/**
 * Email logging functions
 */
async function createEmailLog(emailData) {
  try {
    const result = await pool.query(
      `INSERT INTO email_logs (user_id, recipient_email, subject, html_body, text_body, status, error_reason, ses_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        emailData.user_id,
        emailData.recipient_email,
        emailData.subject,
        emailData.html_body,
        emailData.text_body,
        emailData.status,
        emailData.error_reason || null,
        emailData.ses_message_id || null,
      ]
    );
    return { id: result.rows[0].id, ...emailData };
  } catch (error) {
    console.error('Error creating email log:', error);
    throw error;
  }
}

async function getEmailLog(emailId) {
  try {
    const result = await pool.query(
      'SELECT * FROM email_logs WHERE id = $1',
      [emailId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting email log:', error);
    throw error;
  }
}

/**
 * Health check - test database connection
 */
async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { connected: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function createClient(clientData) {
  try {
    const name = clientData.first_name
      ? `${clientData.first_name} ${clientData.last_name || ''}`.trim()
      : clientData.name || 'Client';
    const result = await pool.query(
      `INSERT INTO clients (customer_id, name, email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [clientData.user_id || clientData.customer_id, name, clientData.email || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
}

async function createScenario(scenarioData) {
  try {
    const params = scenarioData.parameters || {};
    const result = await pool.query(
      `INSERT INTO scenarios (user_id, client_id, name, investment_amount, interest_rate, calculation_result)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        scenarioData.user_id || null,
        scenarioData.client_id || null,
        scenarioData.name || 'Scenario',
        params.investment_amount || null,
        params.interest_rate || null,
        JSON.stringify(params),
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating scenario:', error);
    throw error;
  }
}

module.exports = {
  pool,
  saveScenario,
  getScenarios,
  getScenario,
  deleteScenario,
  healthCheck,
  createUser,
  getUser,
  getUserByEmail,
  updateUserPassword,
  addResetToken,
  getAndVerifyResetToken,
  createScenarioVersion,
  getScenarioVersions,
  getScenarioVersion,
  getVersionCount,
  updateUserSubscription,
  createEmailLog,
  getEmailLog,
  getAdminByCompany,
  createClient,
  createScenario,
};
