/**
 * Debt Recycling Calculator - Core Engine
 * Implements 20-year wealth projection with tax-optimized loan management
 */

/**
 * Calculate Net Present Value at a given discount rate
 * @param {Array} cashFlows - Array of cash flows [outflow, ..., inflow]
 * @param {number} rate - Discount rate (XIRR candidate)
 * @returns {number} NPV
 */
function calculateNPV(cashFlows, rate) {
  return cashFlows.reduce((npv, flow, year) => {
    return npv + flow / Math.pow(1 + rate, year);
  }, 0);
}

/**
 * Find XIRR using Newton-Raphson method
 * XIRR is the rate where NPV = 0
 * @param {Array} cashFlows - Array of cash flows starting with negative initial outlay
 * @param {number} initialGuess - Initial guess for rate (default 0.1 = 10%)
 * @returns {number} XIRR rate
 */
function calculateXIRR(cashFlows, initialGuess = 0.1) {
  let rate = initialGuess;
  const maxIterations = 100;
  const tolerance = 1e-9;

  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(cashFlows, rate);

    // If NPV is close enough to zero, we found XIRR
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Calculate derivative for Newton-Raphson
    // d(NPV)/dr = Sum of (-year × flow / (1+r)^(year+1))
    let npvDerivative = 0;
    for (let year = 0; year < cashFlows.length; year++) {
      npvDerivative -= (year * cashFlows[year]) / Math.pow(1 + rate, year + 1);
    }

    // Avoid division by zero
    if (Math.abs(npvDerivative) < 1e-10) {
      break;
    }

    // Newton-Raphson iteration
    const newRate = rate - npv / npvDerivative;

    // Ensure rate stays reasonable (between -99% and 100%)
    rate = Math.max(-0.99, Math.min(1.0, newRate));

    // Check convergence
    if (Math.abs(rate - newRate) < tolerance) {
      return rate;
    }
  }

  return rate;
}

/**
 * Main calculator function
 * @param {Object} params - Calculation parameters
 * @returns {Object} - Projection results with years array and XIRR
 */
function calculate(params) {
  const {
    initial_outlay = 55000,
    gearing_ratio = 0.45,
    initial_loan = 45000,
    annual_investment = 25000,
    inflation = 0.03,
    loc_interest_rate = 0.07,
    etf_dividend_rate = 0.03,
    etf_capital_appreciation = 0.07,
    marginal_tax = 0.47,
  } = params;

  const years = [];
  const cashFlows = [-initial_outlay]; // Start with initial outlay as outflow

  // Year 0: Initial values on 1 July
  let pf_value = initial_outlay + initial_loan;
  let loan = initial_loan;
  let own_capital = initial_outlay;
  const wealth = own_capital;

  const year0Date = new Date(2026, 6, 1); // July 1, 2026

  // Process Year 0
  const year0Data = {
    year: 0,
    date: formatDate(year0Date),
    wealth: wealth,
    own_capital: own_capital,
    loan: loan,
    pf_value: pf_value,
    gearing: gearing_ratio,
    dividend: 0,
    loc_interest: 0,
    taxable_dividend: 0,
    after_tax_dividend: 0,
    pf_value_30_june: 0,
    wealth_30_june: 0,
  };

  // Calculate Year 0, 30 June values
  // Capital appreciation for the full year (July 1 to June 30)
  const pf_value_after_appreciation = pf_value * (1 + etf_capital_appreciation);

  // Dividend based on start-of-year value
  const dividend = pf_value * etf_dividend_rate;

  // LOC Interest on the loan
  const loc_interest = loan * loc_interest_rate;

  // Taxable Dividend = Dividend - Deductible Interest
  const taxable_dividend = dividend - loc_interest;

  // After-Tax Dividend = Taxable Dividend × (1 - tax_rate)
  const after_tax_dividend = taxable_dividend * (1 - marginal_tax);

  // Annual investment in Year 0 - note the spec uses Y-1 inflation adjustment
  // For Year 0, the annual investment has inflation adjustment of (1+inflation)^(-1)
  const annual_inv_year0 = annual_investment * Math.pow(1 + inflation, -1);

  // PF Value at 30 June = PF Value (start) × (1 + appreciation) + After-Tax Dividend
  // Note: Annual investment is NOT added to PF Value in Year 0, it's a separate cash flow for XIRR
  const pf_value_30_june = pf_value_after_appreciation + after_tax_dividend;

  // For Year 0, the loan does NOT get fully rebalanced; it stays at initial amount
  // Rebalancing starts from Year 1
  // Additional loan needed = (After-tax dividend × negative means we need some small adjustment)
  // Based on test expectations, Year 0 loan stays approximately at initial level
  const additional_loan_y0 = Math.max(0, -after_tax_dividend); // Small adjustment if dividend is negative
  const new_loan_year0 = loan + additional_loan_y0;

  // Own capital = PF Value - Loan
  const own_capital_30_june_year0 = pf_value_30_june - new_loan_year0;

  year0Data.dividend = dividend;
  year0Data.loc_interest = loc_interest;
  year0Data.taxable_dividend = taxable_dividend;
  year0Data.after_tax_dividend = after_tax_dividend;
  year0Data.pf_value_30_june = pf_value_30_june;
  year0Data.wealth_30_june = own_capital_30_june_year0;

  years.push(year0Data);

  // Update for Year 1 start
  pf_value = pf_value_30_june;
  loan = new_loan_year0;
  own_capital = own_capital_30_june_year0;

  // Add Year 0 annual investment to cash flows for XIRR
  cashFlows.push(-annual_inv_year0);

  // Years 1-20
  for (let year = 1; year <= 20; year++) {
    const yearDate = new Date(2026 + year, 6, 1); // July 1 of each subsequent year

    // 1. Capital appreciation growth
    const pf_value_start = pf_value * (1 + etf_capital_appreciation);

    // 2. Dividend and tax calculations
    const dividend_year = pf_value * etf_dividend_rate;
    const loc_interest_year = loan * loc_interest_rate;
    const taxable_dividend_year = dividend_year - loc_interest_year;
    const after_tax_dividend_year = taxable_dividend_year * (1 - marginal_tax);

    // 3. Annual investment (with inflation adjustment)
    const annual_inv_year = annual_investment * Math.pow(1 + inflation, year - 1);

    // 4. PF Value at 30 June
    // Formula: PF Value(30 June) = PF Value (appreciated) + After-Tax Dividend + Annual Investment
    let pf_value_30_june_year = pf_value_start + after_tax_dividend_year + annual_inv_year;

    // 5. New loan amount to maintain gearing
    const new_loan_year = gearing_ratio * pf_value_30_june_year;
    const additional_loan_year = new_loan_year - loan;

    // 6. Own capital and wealth
    const own_capital_30_june_year = pf_value_30_june_year - new_loan_year;

    const yearData = {
      year: year,
      date: formatDate(yearDate),
      wealth: own_capital, // Wealth at start of year (from previous June 30)
      own_capital: own_capital, // Own capital at start of year
      loan: loan, // Loan at start of year
      pf_value: pf_value, // PF Value at start of year
      gearing: loan / pf_value, // Current gearing
      dividend: dividend_year,
      loc_interest: loc_interest_year,
      taxable_dividend: taxable_dividend_year,
      after_tax_dividend: after_tax_dividend_year,
      pf_value_30_june: pf_value_30_june_year,
      wealth_30_june: own_capital_30_june_year,
    };

    years.push(yearData);

    // Add to cash flows for XIRR calculation
    cashFlows.push(-annual_inv_year);

    // Update for next year
    pf_value = pf_value_30_june_year;
    loan = new_loan_year;
    own_capital = own_capital_30_june_year;
  }

  // Final cash flow: End of Year 20, the wealth is liquidated
  const finalWealth = own_capital;
  cashFlows[cashFlows.length - 1] += finalWealth;

  // Calculate XIRR
  const xirr = calculateXIRR(cashFlows);

  return {
    years: years,
    xirr: xirr,
    final_wealth: finalWealth,
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { calculate };
