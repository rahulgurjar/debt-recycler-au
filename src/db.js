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

async function createUser(email, passwordHash, companyName = 'Company', role = 'admin') {
  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, company_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, password_hash, company_name, role`,
      [email, passwordHash, companyName, role]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
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
       VALUES ($1, $2, to_timestamp($3/1000.0))`,
      [userId, resetToken, expiryTime]
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
       ORDER BY created_at DESC
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

async function createScheduledEmail(scheduleData) {
  try {
    const result = await pool.query(
      `INSERT INTO scheduled_emails (user_id, client_id, scenario_id, scheduled_date, frequency, subject, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, next_send_date`,
      [
        scheduleData.user_id,
        scheduleData.client_id,
        scheduleData.scenario_id,
        scheduleData.scheduled_date,
        scheduleData.frequency,
        scheduleData.subject,
        scheduleData.active !== false,
      ]
    );
    return { id: result.rows[0].id, next_send_date: result.rows[0].next_send_date, ...scheduleData };
  } catch (error) {
    console.error('Error creating scheduled email:', error);
    throw error;
  }
}

async function getScheduledEmail(scheduleId) {
  try {
    const result = await pool.query(
      'SELECT * FROM scheduled_emails WHERE id = $1',
      [scheduleId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting scheduled email:', error);
    throw error;
  }
}

async function updateScheduledEmail(scheduleId, updates) {
  try {
    const fields = [];
    const values = [scheduleId];
    let paramNum = 2;

    if (updates.active !== undefined) {
      fields.push(`active = $${paramNum}`);
      values.push(updates.active);
      paramNum++;
    }
    if (updates.next_send_date) {
      fields.push(`next_send_date = $${paramNum}`);
      values.push(updates.next_send_date);
      paramNum++;
    }

    if (fields.length === 0) return;

    await pool.query(
      `UPDATE scheduled_emails SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  } catch (error) {
    console.error('Error updating scheduled email:', error);
    throw error;
  }
}

async function getScheduledEmailsDue() {
  try {
    const result = await pool.query(
      `SELECT * FROM scheduled_emails WHERE active = true AND next_send_date <= NOW()`,
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error getting scheduled emails due:', error);
    throw error;
  }
}

/**
 * Campaign functions
 */
async function createCampaign(campaignData) {
  try {
    const result = await pool.query(
      `INSERT INTO email_campaigns (user_id, subject, message, total_count, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        campaignData.user_id,
        campaignData.subject,
        campaignData.message,
        campaignData.total_count,
        'in_progress',
      ]
    );
    return { id: result.rows[0].id, ...campaignData };
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
}

async function getCampaign(campaignId) {
  try {
    const result = await pool.query(
      'SELECT * FROM email_campaigns WHERE id = $1',
      [campaignId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting campaign:', error);
    throw error;
  }
}

async function updateCampaign(campaignId, updates) {
  try {
    const fields = [];
    const values = [campaignId];
    let paramNum = 2;

    if (updates.sent_count !== undefined) {
      fields.push(`sent_count = $${paramNum}`);
      values.push(updates.sent_count);
      paramNum++;
    }
    if (updates.failed_count !== undefined) {
      fields.push(`failed_count = $${paramNum}`);
      values.push(updates.failed_count);
      paramNum++;
    }
    if (updates.status) {
      fields.push(`status = $${paramNum}`);
      values.push(updates.status);
      paramNum++;
    }

    if (fields.length === 0) return;

    await pool.query(
      `UPDATE email_campaigns SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
}

/**
 * Helper functions
 */
async function getClientsByAdvisor(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE user_id = $1',
      [userId]
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error getting advisor clients:', error);
    throw error;
  }
}

async function getClientsByIds(clientIds) {
  try {
    const placeholders = clientIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT * FROM clients WHERE id IN (${placeholders})`,
      clientIds
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error getting clients by ids:', error);
    throw error;
  }
}

async function getClient(clientId) {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [clientId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting client:', error);
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
    console.error('Error getting user:', error);
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

module.exports = {
  pool,
  saveScenario,
  getScenarios,
  getScenario,
  deleteScenario,
  healthCheck,
  createUser,
  getUserByEmail,
  updateUserPassword,
  addResetToken,
  getAndVerifyResetToken,
  createScenarioVersion,
  getScenarioVersions,
  getScenarioVersion,
  getVersionCount,
  createEmailLog,
  getEmailLog,
  createScheduledEmail,
  getScheduledEmail,
  updateScheduledEmail,
  getScheduledEmailsDue,
  createCampaign,
  getCampaign,
  updateCampaign,
  getClientsByAdvisor,
  getClientsByIds,
  getClient,
  getUser,
};
