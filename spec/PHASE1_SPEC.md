# Phase 1 Specification — Debt Recycling Calculator Core

## Summary
Implement the core debt recycling calculator engine and Express server that performs 20-year wealth projections using the business rules in spec/03_business_rules.md.

## Success Criteria

### 1. Calculator Tests (tests/calculator.test.js)
All tests MUST pass with ±0.01% accuracy tolerance.

**Test 1 — Year 0 Baseline**
- Input: Initial outlay $55k, 45% gearing, 7% LOC rate, 3% dividend, 7% appreciation, 47% tax
- Expected Year 0, 30 June: PF Value = $106,921, Wealth = $61,841
- Verification: `npm test` passes

**Test 2 — Year 10**
- Expected: Wealth = $784,624
- Verification: `npm test` passes

**Test 3 — Year 20 + XIRR**
- Expected: Wealth = $2,929,892, XIRR = 12.55%
- Verification: `npm test` passes

**Test 4 — Sensitivity Analysis**
- LOC rates: 4%, 7%, 10%
- Expected: Different XIRR values for each rate
- Verification: `npm test` passes

### 2. Calculator Implementation (src/calculator.js)
Implement all formulas from spec/03_business_rules.md:
- Year 0 initialization
- Years 1-20 projections with capital growth, dividends, tax, loans, and rebalancing
- XIRR calculation using NPV formula
- Output: Array of year objects with all calculated fields

**Return Structure:**
```javascript
{
  years: [
    { year, date, wealth, own_capital, loan, pf_value, gearing,
      dividend, loc_interest, taxable_dividend, after_tax_dividend,
      pf_value_30_june, wealth_30_june },
    ...
  ],
  xirr: 0.1255,
  final_wealth: 2929892
}
```

### 3. Express Server (src/index.js)
- POST /api/calculate: Accept calculation parameters, return projection
- Must integrate with calculator.js
- Must pass tests

### 4. Database Schema (backend/db/schema.sql)
- scenarios table: Store calculation scenarios
- projections table: Store year-by-year projections
- Support save/load workflow

## Technical Requirements
- Framework: Node.js + Express
- Testing: Jest with ≥80% coverage
- Accuracy: ±0.01% on all financial calculations
- Linting: ESLint + Prettier (format on commit)
- Git: Commit to feature/phase1 branch when done

## Verification Commands
```bash
npm install                    # Install dependencies ✓
npm test                       # Run calculator tests (ALL PASS)
npm run lint                   # Check code formatting
npm run format                 # Auto-format code
npm start                      # Start Express server
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{...parameters...}'
```

## Files to Create
1. tests/calculator.test.js — 4 test suites
2. src/calculator.js — Core calculation engine
3. src/index.js — Express server with POST /api/calculate
4. backend/db/schema.sql — Database schema
5. .prettierrc.json — Prettier config (if needed)
6. jest.config.js — Jest config (if needed)

## Test/Build Cycle
1. Create failing tests
2. Run: `npm test` (expect failures)
3. Implement calculator
4. Run: `npm test` (expect passes)
5. Implement server
6. Run: `npm test` (expect passes)
7. Format: `npm run format`
8. Commit to feature/phase1
