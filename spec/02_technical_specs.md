# Technical Specification — Debt Recycler AU

## Stack

- **Frontend:** React 18, Vite, TypeScript
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (AWS RDS)
- **Tests:** Jest + React Testing Library
- **Deploy:** AWS Lambda + API Gateway
- **Hosting:** AWS S3 + CloudFront (static frontend)
- **Custom Domain:** debt-recycler-au.com (Route53 DNS)

## Architecture

```
Public Internet
      ↓
┌─────────────────────────────────────────────┐
│   debt-recycler-au.com                      │
│   (Route53 DNS)                             │
└──────────────┬──────────────────────────────┘
               ↓
        CloudFront (CDN)
        (HTTPS, caching)
        ↙              ↘
    S3 Bucket        API Gateway
    (Frontend)       (REST API)
    - index.html       ↓
    - assets        Lambda Functions
                    - /api/calculate
                    - /api/scenarios
                    - /api/projects/:id
                       ↓
                    RDS PostgreSQL
                    (scenarios, projections)
```

## GitHub Repository

**URL:** github.com/rahulgurjar/debt-recycler-au

**Structure:**
```
debt-recycler-au/
├── frontend/              (React SPA)
│   ├── src/
│   ├── public/
│   └── vite.config.ts
├── backend/               (Node.js)
│   ├── src/
│   │   ├── index.js       (Express server)
│   │   ├── calculator.js  (core logic)
│   │   └── db.js          (PostgreSQL client)
│   └── package.json
├── infra/                 (AWS CloudFormation/SAM)
│   ├── template.yaml      (Lambda + API Gateway)
│   └── db/
│       └── schema.sql     (PostgreSQL schema)
├── .github/workflows/     (CI/CD)
│   ├── test.yml           (Run tests on PR)
│   └── deploy.yml         (Deploy on main)
├── spec/                  (Technical & business specs)
├── tests/                 (Shared test fixtures)
└── README.md
```

## CI/CD Pipeline (GitHub Actions)

**On Every PR:**
- Run Jest tests (backend + frontend)
- Check coverage (≥80% required)
- Lint + format check
- Build React SPA (verify no errors)

**On Merge to Main:**
- Run full test suite
- Build & push Lambda functions to AWS
- Deploy RDS migrations (if any)
- Upload frontend to S3
- Invalidate CloudFront cache
- Tag release in git (semantic versioning)

## API Endpoints

### POST /api/calculate

Calculate 20-year debt recycling projection.

**Request:**
```json
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

**Response:**
```json
{
  "years": [
    {
      "year": 0,
      "date": "2026-07-01",
      "wealth": 55000,
      "own_capital": 55000,
      "loan": 45000,
      "pf_value": 100000,
      "gearing": 0.45,
      "dividend": 3000,
      "loc_interest": 3150,
      "taxable_dividend": -150,
      "after_tax_dividend": -79,
      "pf_value_30_june": 106921,
      "wealth_30_june": 61841
    },
    ...
  ],
  "xirr": 0.1255,
  "final_wealth": 2929892
}
```

### POST /api/scenarios

Save a scenario.

**Request:**
```json
{
  "name": "Conservative (4% rates)",
  "parameters": { ... same as /calculate input ... }
}
```

**Response:**
```json
{
  "id": "sc_123abc",
  "name": "Conservative (4% rates)",
  "created_at": "2026-03-25T00:30:00Z",
  "url": "/api/scenarios/sc_123abc"
}
```

### GET /api/scenarios/:id

Fetch saved scenario + full projection.

### GET /api/scenarios

List all saved scenarios (paginated).

## Database Schema

### scenarios table

```sql
CREATE TABLE scenarios (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32),
  name VARCHAR(255),
  initial_outlay DECIMAL(12,2),
  gearing_ratio DECIMAL(5,4),
  initial_loan DECIMAL(12,2),
  annual_investment DECIMAL(12,2),
  inflation DECIMAL(5,4),
  loc_interest_rate DECIMAL(5,4),
  etf_dividend_rate DECIMAL(5,4),
  etf_capital_appreciation DECIMAL(5,4),
  marginal_tax DECIMAL(5,4),
  xirr DECIMAL(8,6),
  final_wealth DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### projections table

```sql
CREATE TABLE projections (
  id VARCHAR(32) PRIMARY KEY,
  scenario_id VARCHAR(32),
  year INT,
  wealth DECIMAL(15,2),
  own_capital DECIMAL(15,2),
  loan DECIMAL(15,2),
  pf_value DECIMAL(15,2),
  gearing DECIMAL(5,4),
  dividend DECIMAL(12,2),
  loc_interest DECIMAL(12,2),
  taxable_dividend DECIMAL(12,2),
  after_tax_dividend DECIMAL(12,2),
  pf_value_30_june DECIMAL(15,2),
  wealth_30_june DECIMAL(15,2)
);
```

## Calculations

See spec/03_business_rules.md for detailed formulas.

Key calculations per year:

1. PF Value (Year Start) = PF Value (End of Last Year) × (1 + capital_appreciation)
2. PF Value (after dividend) = PF Value + (PF Value × dividend_rate) - dividend_tax
3. New Loan = target_gearing × (Property Value + existing debt)
4. XIRR = solve for rate r where NPV = 0 over 20-year cash flow

Test against spreadsheet Table 1, rows 4-24 for validation.
