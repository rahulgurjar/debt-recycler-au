# Phase 1: Core API & Calculation Engine

## Task 1: Calculator Module (calculator.js)
**Spec:** spec/03_business_rules.md
**Build:** src/calculator.js
- Implement all formulas: PF Value, gearing, dividend, LOC interest, taxable income, after-tax dividend
- Calculate XIRR (internal rate of return)
- Generate 20-year projection array
- **Test:** Validate against spreadsheet Table 1, rows 4-24 (±0.01% tolerance)
- **Output:** calculator.js (500-1000 lines)

## Task 2: Jest Tests (calculator.test.js)
**Spec:** spec/03_business_rules.md → Test Cases
**Build:** tests/calculator.test.js
- Test baseline (Row 4): Initial outlay $55k, Year 0 result = $106,921
- Test Year 10 (Row 14): Wealth = $784,624
- Test Year 20 (Row 24): Wealth = $2,929,892, XIRR = 12.55%
- Test sensitivity: LOC rate 4% → 12% (different XIRR)
- **Output:** calculator.test.js (200+ lines, 15-20 tests)

## Task 3: Express API Endpoints
**Spec:** spec/02_technical_specs.md → API Endpoints
**Build:** src/index.js (update), src/db.js
- POST /api/calculate → call calculator, return projection
- POST /api/scenarios → save to DB
- GET /api/scenarios/:id → fetch from DB
- GET /api/scenarios → list all (paginated)
- **Test:** integration tests (mock DB, real calculator)

## Task 4: Database Schema & Migrations
**Spec:** spec/02_technical_specs.md → Database Schema
**Build:** backend/db/schema.sql, db/migrations/
- Create scenarios table (initial_outlay, gearing_ratio, loc_interest_rate, etc.)
- Create projections table (year-by-year results)
- Write migration script
- **Test:** Schema validates, inserts work, queries return expected results

## Success Criteria

✅ All tests pass: `npm test` → 100% pass rate, ≥80% coverage
✅ Calculator matches spreadsheet: ±0.01% on all test cases
✅ API endpoints tested & working
✅ Database schema migrated
✅ All code committed to feature/phase1 branch

---

## Pre-conditions (verified before starting)

- [x] spec/02_technical_specs.md exists
- [x] spec/03_business_rules.md exists
- [x] package.json exists with Jest
- [x] Node.js 18+ installed

## Post-conditions (verified after completion)

- [ ] All 15+ tests pass: `npm test`
- [ ] Coverage ≥80%
- [ ] calculator.js matches spreadsheet ±0.01%
- [ ] src/index.js has all 4 endpoints working
- [ ] Schema migrations applied

---

## Time Estimate

- Task 1 (calculator): 3-4 hours (formulas are complex)
- Task 2 (tests): 2 hours (test cases from spec)
- Task 3 (API): 2 hours (3 endpoints, standard Express)
- Task 4 (DB): 1 hour (schema + migration)

**Total: 8-9 hours** → ~2 working days with breaks
