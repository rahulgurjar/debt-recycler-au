/**
 * Express API Server for Debt Recycling Calculator
 * Endpoints:
 * - POST /api/calculate: Submit parameters, get 20-year projection
 * - POST /api/scenarios: Save a scenario
 * - GET /api/scenarios: List saved scenarios
 * - GET /api/scenarios/:id: Get one scenario with full projection
 */

const express = require('express');
const { calculate } = require('./calculator');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
 * Save a scenario (requires database)
 */
app.post('/api/scenarios', (req, res) => {
  res.json({
    success: false,
    error: 'Database not yet configured. Use /api/calculate for one-off projections.',
  });
});

/**
 * GET /api/scenarios
 * List saved scenarios (requires database)
 */
app.get('/api/scenarios', (req, res) => {
  res.json({
    success: false,
    error: 'Database not yet configured.',
    scenarios: [],
  });
});

/**
 * GET /api/scenarios/:id
 * Get one scenario (requires database)
 */
app.get('/api/scenarios/:id', (req, res) => {
  res.json({
    success: false,
    error: 'Database not yet configured.',
  });
});

module.exports = app;
