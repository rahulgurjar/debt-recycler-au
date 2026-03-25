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
};
