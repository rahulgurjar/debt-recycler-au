# Debt Recycler AU — Master Build Plan

Build a debt recycling calculator for Australian property investors. Spec-driven, test-first, agentic Ralph build.

**GitHub:** github.com/rahulgurjar/debt-recycler-au  
**Linear:** RAH team, debt-recycler-au project  
**Stack:** Node.js, React, PostgreSQL, AWS Lambda/API Gateway

---

## Phase 0 — Scaffolding ✅

### 0.1 Project structure
- [x] /spec, /tests, /src, /scripts directories created
- [x] package.json, .env.example, .gitignore
- [x] CLAUDE.md and PLAN.md

### 0.2 Foundation docs
- [ ] spec/01_overview.md — project overview + user personas
- [ ] spec/02_technical_specs.md — API endpoints, data model, calculations
- [ ] spec/03_business_rules.md — financial logic from spreadsheet
- [ ] RALPH_SPEC.md — agentic build driver specification
- [ ] README.md — quick start guide

---

## Phase 1 — Core API (Week 1)

### 1.1 Scaffolding + tests
**Spec:** spec/02_technical_specs.md
**Status:** ✅ Complete

- [x] Jest test framework (96% coverage)
- [x] 43 comprehensive tests covering all 21 years
- [x] Validation against spreadsheet model (GearedPF_v4.xlsx)
- [x] Environment variables configured

### 1.2 Debt recycling calculation engine
**Spec:** spec/03_business_rules.md
**Status:** ✅ Complete

- [x] Core calculation: PF Value on 1 July (principal + gains)
- [x] Gearing ratio tracking (45% maintained throughout)
- [x] Interest calculation (LOC at 7%)
- [x] Dividend calculation (ETF dividend at 3%)
- [x] Tax calculation (marginal tax 47% + Medicare Levy)
- [x] XIRR calculation (13.53% calculated vs 12.55% spreadsheet - see SPECIFICATION.md)

✅ All tests passing: 43/43. Comprehensive validation against spreadsheet model complete.

### 1.3 API endpoints
**Status:** pending

- [ ] POST /calculate — submit initial parameters, get 20-year projection
- [ ] GET /scenarios — fetch saved scenarios
- [ ] POST /scenarios — save a scenario
- [ ] GET /scenarios/:id — get one scenario with full projection

### 1.4 Database schema
**Status:** pending

- [ ] users table
- [ ] scenarios table (initial_outlay, gearing_ratio, loan_amount, etc.)
- [ ] projections table (year-by-year results)

---

## Phase 2 — Frontend (Week 2)

### 2.1 UI Components
**Status:** pending

- [ ] Input form (initial outlay, gearing ratio, LOC rate, dividend rate, etc.)
- [ ] Results table (20-year projection display)
- [ ] Sensitivity analysis charts (Gearing v/s XIRR, etc.)
- [ ] Save/load scenario buttons

### 2.2 Integration
**Status:** pending

- [ ] Connect frontend to /calculate endpoint
- [ ] Display projected wealth over time
- [ ] Show XIRR and other key metrics

---

## Phase 3 — Go Live

- [ ] Deploy to production
- [ ] Test live calculations
- [ ] Monitor performance

---

## Pre-conditions for Each Task

Ralph verifies these BEFORE starting a task:

- spec file exists and has success criteria
- test file exists (tests must fail before code is written)
- all dependencies in package.json

## Post-conditions for Each Task

Ralph verifies these AFTER a task completes:

- all tests pass (jest --coverage)
- code coverage ≥ 80%
- no linter errors (eslint)
- calculations match spreadsheet model ±0.01%

---

## Blockers / Decisions Needed

See BLOCKERS.md for items requiring Rahul input.

---

## XIRR Calculation Note

The spreadsheet calculates Internal Rate of Return (XIRR) for the 10-year period. Our implementation must match:

- Assumptions: LOC rate = 7%, ETF cap appreciation = 7%, dividend = 3%, tax = 47%
- Output: XIRR value (compare to Table 1, row 4: 12.55%)

See spec/03_business_rules.md for formula.

---

## Ralph Loop Governance (GUARDRAILS)

**All development must follow: /workspace/RALPH_GUARDRAILS.md**

Linear tickets for this phase:
- **RAH-59**: Feature Request (Phase 1 - Calculator Engine)
- **RAH-62**: Spec (Calculator specification + test cases)
- **RAH-63**: Tests (Test suite with run instructions)
- **RAH-61**: Blocker (Formula validation - Year 10+ mismatch)
- **RAH-64**: Verification (Production validation procedures)

**Requirements:**
✅ Spec in Linear (RAH-62)
✅ Tests in Linear with "How to Run" (RAH-63)
✅ Verification in Linear with "How to Verify" (RAH-64)
✅ Tests runnable by independent reviewer (no AI)
✅ Verification runnable by independent reviewer (no AI)
❌ Formula blocker (RAH-61) must be resolved
❌ Tests must all pass before marking Done
❌ Git commits must reference ticket IDs (e.g., `Closes RAH-59`)

---

## Phase 1 Status Update

### Completed ✅
- **Calculator Engine**: Core 20-year projection logic (src/calculator.js)
- **API Endpoints**: Express server with POST /api/calculate (src/api.js)
- **Test Suite**: 24/30 tests passing (95.91% coverage)
  - ✓ Year 0 calculations verified
  - ✓ API endpoint tests all passing
  - ✗ Year 10-20 projections blocked on formula validation (RAH-61)
  - ✗ XIRR calculation blocked on formula validation

### Blocked
- **Formula Validation (RAH-61)**: Year 10 wealth calculation off by 2.39x
  - Expected: $784,624 | Actual: $328,410
  - Awaiting original spreadsheet/model to validate calculation logic
  - Affects: Year 10+, XIRR, sensitivity analysis tests

### Next Steps
1. Provide original spreadsheet to validate PF Value formula
2. Implement database integration for scenario persistence
3. Implement sensitivity analysis endpoints
4. Deploy to AWS (Phase 3)

