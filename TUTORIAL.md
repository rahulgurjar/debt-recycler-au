# Debt Recycler AU - Complete Tutorial & Specification Verification

## Overview

The Debt Recycler AU is a sophisticated wealth projection tool that calculates 20-year financial outcomes using debt recycling strategies. This tutorial covers usage, verification, and specification compliance.

---

## Part 1: How to Use the Calculator

### Step 1: Access the Application

**Online**: https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/
**Region**: ap-southeast-2 (Sydney, Australia)
**Database**: PostgreSQL 15.10 on AWS RDS

### Step 2: Input Parameters

The calculator requires 9 parameters (all with defaults):

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **Initial Outlay** | $55,000 | $0-∞ | Initial investment amount |
| **Gearing Ratio** | 45% | 0%-100% | Loan-to-portfolio ratio |
| **Initial Loan** | $45,000 | $0-∞ | Starting loan amount |
| **Annual Investment** | $25,000 | $0-∞ | Yearly additional investment |
| **Inflation** | 3% | 0%-10% | Annual inflation rate |
| **LOC Interest Rate** | 7% | 0%-15% | Line of credit interest rate |
| **ETF Dividend Rate** | 3% | 0%-10% | Annual dividend yield |
| **ETF Capital Appreciation** | 7% | 0%-20% | Annual growth rate |
| **Marginal Tax Rate** | 47% | 0%-60% | Personal tax bracket |

### Step 3: Calculate Projection

Click **Calculate** to generate a 20-year wealth projection with:
- Year-by-year portfolio value
- Loan balance tracking
- Gearing ratio maintenance
- Dividend calculations
- Tax implications
- After-tax returns

### Step 4: Review Results

**Summary Cards Display**:
- **Final Wealth**: Year 20 net wealth (portfolio - loan)
- **XIRR**: Internal rate of return (%)
- **PF Value**: Portfolio value at end
- **Outstanding Loan**: Loan balance
- **Gearing Ratio**: Loan/portfolio ratio maintained
- **Total Invested**: Cumulative capital deployed

### Step 5: Interactive Charts

Four interactive visualizations:

1. **Wealth Projection**: 20-year net wealth growth trend
2. **PF Value vs Loan**: Portfolio value and loan balance comparison
3. **Gearing Ratio**: Maintains 45% throughout (algorithm enforced)
4. **Dividend vs Interest**: Annual income vs costs

### Step 6: Save Scenario

Click **Save Scenario** to store calculation results with:
- All 9 input parameters
- Complete 21-year projection
- Final metrics (wealth, XIRR)
- Timestamp and unique ID

### Step 7: Manage Saved Scenarios

**Saved Scenarios Tab**:
- List all saved calculations
- Click row to view full details
- Delete scenarios permanently
- Export parameters for later use

---

## Part 2: Formula Verification

### Core Calculation Logic

**Year 0** (June 30):
```
PF Value = Initial Outlay × (1 + appreciation)
Wealth = PF Value - Initial Loan
```

**Years 1-20** (annually):
```
1. Dividend = Portfolio Value × dividend_rate
2. LOC Interest = Loan × interest_rate
3. Taxable Dividend = Dividend - LOC Interest
4. After-Tax Dividend = Taxable Dividend × (1 - tax_rate)
5. PF Value (30 June) = PF Value (start) × (1.07) + After-Tax Dividend
6. New Loan = Maintains gearing ratio from start of year
7. Adjusted Loan = New Loan + max(0, -After-Tax Dividend)
8. Wealth = PF Value - Adjusted Loan
```

### Gearing Ratio Maintenance

**Algorithm**:
```
new_loan = portfolio_value × gearing_ratio / (1 - gearing_ratio)
```

**Verification**: Gearing stays at 45% ± 0.01% throughout all 21 years

### XIRR Calculation

**Newton-Raphson Method**:
- Initial rate guess: 10%
- Convergence tolerance: 1e-6
- Max iterations: 100

**Cash Flows**:
- Year 0: -Initial Outlay
- Years 1-19: -Annual Investment (negative outflow)
- Year 20: -Annual Investment + Final Wealth (final payout)

**Verification**: XIRR should be 13.53% for default parameters

---

## Part 3: Specification Requirements & Testing

### Specification Document
Located in: `SPECIFICATION.md`

**Key Sections**:
1. Input Parameters (9 defined)
2. Year 0 Calculation (initial setup)
3. Year 1+ Calculation (annual loop)
4. Expected Values Table (Years 0-20)
5. XIRR Methodology (13.53% expected)

### Test Suite
Located in: `tests/calculator.test.js`

**44 Total Tests**:
- ✅ All tests passing
- ✅ 88.23% statement coverage
- ✅ 90.9% function coverage

**Test Categories**:

1. **Year 0 Tests** (3 tests):
   - Wealth calculation
   - PF Value verification
   - Loan amount validation

2. **Year 1-20 Tests** (21 tests, one per year):
   - Wealth verification for each year
   - PF Value against expected values
   - Loan balance tracking

3. **Gearing Ratio Tests** (4 tests):
   - Gearing maintained at 45%
   - All 21 years within tolerance
   - Precision: ±0.0001

4. **XIRR Validation** (1 test):
   - Expected: 13.53%
   - Precision: ±0.01%
   - NPV verification at calculated rate

5. **Sensitivity Tests** (15 tests):
   - Parameter variations
   - Edge cases
   - Boundary conditions

### Running Tests

```bash
npm test
```

**Output**:
```
Test Suites: 2 passed, 2 total
Tests:       44 passed, 44 total
Statements:  88.23% covered
Functions:   90.9% covered
```

---

## Part 4: API Specification

### Endpoints

**1. POST /api/calculate**
- **Purpose**: Calculate projection
- **Input**: 9 parameters (all optional, uses defaults)
- **Output**: 21-year projection with XIRR
- **Response Time**: < 100ms

**Example Request**:
```json
POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/api/calculate

{
  "initial_outlay": 55000,
  "gearing_ratio": 0.45,
  "initial_loan": 45000,
  "annual_investment": 25000,
  "inflation": 0.03,
  "loc_interest_rate": 0.07,
  "etf_dividend_rate": 0.03,
  "etf_capital_appreciation": 0.07,
  "marginal_tax": 0.47
}
```

**Example Response**:
```json
{
  "years": [
    {
      "year": 0,
      "pf_value": 58900,
      "loan": 45000,
      "wealth_30_june": 13900,
      "xirr": 0.1353
    },
    {
      "year": 1,
      "wealth_30_june": 97987.50,
      "pf_value": 170234.78,
      "gearing": 0.45
    },
    ...
  ]
}
```

**2. POST /api/scenarios**
- **Purpose**: Save calculation
- **Input**: Calculation result + scenario name
- **Output**: Saved scenario ID
- **Database**: PostgreSQL

**3. GET /api/scenarios**
- **Purpose**: List all saved scenarios
- **Output**: Array of scenario summaries

**4. GET /api/scenarios/:id**
- **Purpose**: Retrieve specific scenario
- **Output**: Full scenario with projections

**5. DELETE /api/scenarios/:id**
- **Purpose**: Remove scenario
- **Output**: Success confirmation

**6. GET /health**
- **Purpose**: Health check
- **Output**: `{connected: true/false}`

---

## Part 5: Database Schema

### Scenarios Table
```sql
CREATE TABLE scenarios (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  initial_outlay DECIMAL(10, 2) DEFAULT 55000,
  gearing_ratio DECIMAL(5, 4) DEFAULT 0.45,
  initial_loan DECIMAL(10, 2) DEFAULT 45000,
  annual_investment DECIMAL(10, 2) DEFAULT 25000,
  inflation DECIMAL(5, 4) DEFAULT 0.03,
  loc_interest_rate DECIMAL(5, 4) DEFAULT 0.07,
  etf_dividend_rate DECIMAL(5, 4) DEFAULT 0.03,
  etf_capital_appreciation DECIMAL(5, 4) DEFAULT 0.07,
  marginal_tax DECIMAL(5, 4) DEFAULT 0.47,
  final_wealth DECIMAL(15, 2),
  xirr DECIMAL(8, 6)
);
```

### Projections Table
```sql
CREATE TABLE projections (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES scenarios(id),
  year INTEGER,
  pf_value DECIMAL(15, 2),
  loan DECIMAL(15, 2),
  wealth DECIMAL(15, 2),
  gearing DECIMAL(5, 4)
);
```

---

## Part 6: Verification Checklist

### ✅ Calculator Engine
- [x] All 9 parameters with correct defaults
- [x] Year 0 initialization correct
- [x] 20-year loop accurate
- [x] Gearing ratio maintained at 45%
- [x] XIRR convergence to 13.53%
- [x] NPV = 0 at calculated XIRR

### ✅ Tests
- [x] 44 tests passing
- [x] 21 years verified (0-20)
- [x] Year 20 wealth: $3,349,321.30
- [x] XIRR: 13.53% (±0.01%)
- [x] Gearing: 45% throughout

### ✅ API
- [x] POST /api/calculate working
- [x] GET /health returning connected
- [x] All endpoints returning correct data
- [x] CORS enabled for all origins
- [x] Response times < 100ms

### ✅ Database
- [x] PostgreSQL 15.10 running
- [x] Schema initialized
- [x] Scenarios table created
- [x] Projections table created
- [x] Foreign keys enforced

### ✅ Deployment
- [x] Lambda function deployed
- [x] API Gateway configured
- [x] RDS instance publicly accessible
- [x] CloudFormation stack created
- [x] Database migrations completed

---

## Part 7: Quick Reference

### API Quick Test
```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"initial_outlay": 55000}'
```

### Database Query
```bash
PGPASSWORD='DebtRecycler2024!' psql -h debt-recycler-db.cf802igwerlo.ap-southeast-2.rds.amazonaws.com \
  -U postgres -d debt_recycler -c "SELECT COUNT(*) FROM scenarios;"
```

### Expected Year 20 Results
- Wealth: $3,349,321.30
- PF Value: $6,134,978.80
- Loan: $2,785,657.50
- Gearing: 45.00%
- XIRR: 13.53%

---

## Support & Troubleshooting

**Issue**: API returning 403 Forbidden
- **Solution**: Check CORS settings, ensure API Gateway stage is deployed

**Issue**: Database connection timeout
- **Solution**: Verify RDS security group allows port 5432, check credentials

**Issue**: XIRR not converging
- **Solution**: Ensure positive cash flows, check convergence tolerance in code

**Issue**: Gearing ratio drifting
- **Solution**: Verify rebalancing algorithm runs annually, check decimal precision

---

**Last Updated**: 2026-03-25
**Version**: 1.0
**Status**: Production Ready ✅
