# Debt Recycler AU

Debt recycling calculator for Australian property investors. Calculate 20-year wealth projection based on leveraged ETF investing strategy.

## Quick Start

```bash
# Install dependencies
npm install

# Set up database (PostgreSQL)
createdb debt_recycler_au
psql debt_recycler_au < schema.sql

# Run tests
npm test

# Start dev server
npm run dev
```

## Key Files

- `spec/01_overview.md` — Project overview
- `spec/02_technical_specs.md` — API + database schema
- `spec/03_business_rules.md` — Calculation formulas
- `CLAUDE.md` — Development rules
- `PLAN.md` — Build phases

## Build

Spec-driven, test-first development using Ralph agentic build driver.

```bash
python3 scripts/ralph_loop.py --dry-run    # Check status
python3 scripts/ralph_loop.py              # Build
```

## Core Calculation

Years 1-20 projection based on:
- Initial outlay + annual investments
- Property value growth (capital appreciation)
- ETF dividend reinvestment
- LOC interest deduction
- Gearing ratio maintenance (45% target)
- XIRR calculation (annualized return)

Expected XIRR for baseline scenario: **12.55%** (20-year period).

## References

- Spreadsheet model: `GearedPF_v4.xlsx`
- Formulas: `spec/03_business_rules.md`
