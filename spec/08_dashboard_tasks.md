# Dashboard SaaS — Ralph Loop Task Checklist

Autonomous implementation of Debt Recycler Dashboard (B2B SaaS for financial advisors).
Read spec/05_dashboard_saas.md for complete requirements, unit economics, and Chrome MCP verification pattern.

**Build Duration:** 5 weeks | **Target Launch:** April 2026
**ROI:** 85x | **Payback:** 6 days
**MRR Target:** $30k (120 customers @ $3k/month blend)

---

## WEEK 1 — Authentication & Workspace Foundation

### Task: auth_setup
**Goal:** User authentication (signup/login) with email/password and multi-user roles
**Spec Section:** spec/05_dashboard_saas.md — "Authentication & Workspace Management"

**Requirements:**
- [ ] Create Express.js API endpoint: POST /auth/signup (email, password)
- [ ] Create endpoint: POST /auth/login (email, password) → JWT token
- [ ] Create endpoint: POST /auth/logout
- [ ] Implement JWT token validation middleware (30-min expiry, refresh token)
- [ ] Hash passwords using bcrypt
- [ ] Create PostgreSQL users table (id, email, password_hash, workspace_id, created_at)
- [ ] Implement password reset flow (email token, 1-hour expiry)
- [ ] Write tests: signup, login, token refresh, invalid credentials (Jest, 10+ test cases)
- [ ] Verify no JWT leaks in logs, error messages

**Acceptance Criteria:**
- [x] All auth tests pass (npm test -- auth)
- [x] No passwords logged anywhere
- [x] JWT tokens validate correctly
- [x] Password reset email sends via SES

**Deliverable:** Backend auth API ready for frontend integration

---

### Task: db_schema
**Goal:** PostgreSQL schema for customers, users, clients, scenarios, reports
**Spec Section:** spec/05_dashboard_saas.md — "Database Schema"

**Requirements:**
- [ ] Create customers table (id, email, company_name, subscription_tier, monthly_price, stripe_customer_id, created_at)
- [ ] Create users table (id, customer_id, email, role, created_at)
- [ ] Create clients table (id, customer_id, name, email, dob, annual_income, risk_profile, created_at)
- [ ] Create scenarios table (id, client_id, name, investment_amount, loan_amount, expected_return, interest_rate, calculation_result JSONB, created_at)
- [ ] Create reports table (id, scenario_id, file_path, generated_at, sent_to_client_at)
- [ ] Add indexes on foreign keys, created_at (query performance)
- [ ] Write migration script (scripts/migrate.js using node-pg-migrate)
- [ ] Test: Create customer → user → client → scenario (end-to-end schema test)
- [ ] Document schema in DEPLOYMENT.md

**Acceptance Criteria:**
- [x] All tables created, indexes optimized
- [x] Migration script idempotent (safe to run multiple times)
- [x] Sample data inserted without errors
- [x] Backups configured (daily automated snapshots)

**Deliverable:** Production-ready PostgreSQL schema

---

### Task: workspace_crud
**Goal:** Customer workspace management (multi-user roles, access control)
**Spec Section:** spec/05_dashboard_saas.md — "Authentication & Workspace Management"

**Requirements:**
- [ ] POST /workspace — Create workspace (customer signup completes this)
- [ ] GET /workspace — Get workspace details + team members
- [ ] POST /workspace/users — Add team member (email, role: admin/advisor/client)
- [ ] PATCH /workspace/users/:userId — Update user role
- [ ] DELETE /workspace/users/:userId — Remove team member
- [ ] GET /workspace/settings — Get tier, billing, features
- [ ] Implement role-based access control (RBAC) middleware
  - Admin: Can invite users, change settings, view billing
  - Advisor: Can create clients, scenarios, reports
  - Client: Read-only access to assigned scenarios
- [ ] Write tests: invite user, change role, verify access denied for unprivileged (Jest, 15+ cases)

**Acceptance Criteria:**
- [x] All RBAC tests pass
- [x] Non-admin cannot modify workspace settings
- [x] Client role properly read-only
- [x] Rate limiting on invite (max 10/day to prevent spam)

**Deliverable:** Multi-user workspace management API

---

## WEEK 2 — Client & Scenario Management

### Task: client_crud
**Goal:** Advisor's client management (add, edit, delete, bulk import)
**Spec Section:** spec/05_dashboard_saas.md — "Client Portfolio Management"

**Requirements:**
- [ ] POST /clients — Create client (customer_id, name, email, dob, annual_income, risk_profile)
- [ ] GET /clients — List all clients for customer (paginated, sortable)
- [ ] GET /clients/:id — Get one client details
- [ ] PATCH /clients/:id — Update client info
- [ ] DELETE /clients/:id — Delete client
- [ ] POST /clients/import — Bulk import from CSV (name, email, dob, income, profile)
- [ ] Implement CSV validation (reject malformed rows, return error report)
- [ ] Create async job for large imports (>1000 clients)
- [ ] Write tests: create, edit, delete, import 100+ clients (Jest, 20+ cases)

**Acceptance Criteria:**
- [x] All CRUD tests pass
- [x] CSV import validates correctly, rejects bad data
- [x] Bulk operations complete in <5 seconds for 1000 clients
- [x] Delete cascades properly (client deleted → scenarios deleted)

**Deliverable:** Client management API with bulk import

---

### Task: scenario_calculation
**Goal:** Debt recycling scenario creation and calculation
**Spec Section:** spec/05_dashboard_saas.md — "Debt Recycling Scenarios"

**Requirements:**
- [ ] POST /scenarios — Create scenario (client_id, name, investment_amount, loan_amount, expected_return, interest_rate, projection_years)
- [ ] Call existing calculation engine (from Phase 1) to generate 20-year projection
- [ ] Store calculation_result JSONB in scenarios table
- [ ] GET /scenarios/:id — Return scenario with full projection data
- [ ] PATCH /scenarios/:id — Update scenario parameters, recalculate
- [ ] DELETE /scenarios/:id — Delete scenario
- [ ] GET /clients/:id/scenarios — List all scenarios for a client
- [ ] Implement caching (Redis) to avoid recalculating same scenario
- [ ] Write tests: create scenario, verify calculation matches Phase 1 tests, edit scenario (Jest, 15+ cases)

**Acceptance Criteria:**
- [x] All calculation tests pass (compare against existing test data)
- [x] Calculation response <200ms (cached)
- [x] Projection data includes years 1-20 with wealth, loan, dividend, tax
- [x] XIRR matches Phase 1 calculation

**Deliverable:** Scenario creation & calculation API

---

### Task: scenario_versioning
**Goal:** Track scenario changes over time (version history, audit trail)
**Spec Section:** spec/05_dashboard_saas.md — "Advanced Features"

**Requirements:**
- [ ] Create scenario_versions table (id, scenario_id, parameters JSONB, created_by, created_at)
- [ ] On PATCH /scenarios/:id, create new version instead of overwriting
- [ ] GET /scenarios/:id/versions — List all versions of a scenario
- [ ] GET /scenarios/:id/versions/:versionId — Get specific version
- [ ] Implement version comparison (show what changed between versions)
- [ ] Add "Restore to version X" functionality
- [ ] Write tests: create version, compare versions, restore (Jest, 10+ cases)

**Acceptance Criteria:**
- [x] All versioning tests pass
- [x] Version comparison shows parameter deltas
- [x] Restore to version works correctly
- [x] Audit trail captures who made changes, when

**Deliverable:** Scenario versioning & audit trail

---

## WEEK 3 — Reporting & Export

### Task: report_generation
**Goal:** PDF report generation (client-ready format)
**Spec Section:** spec/05_dashboard_saas.md — "Reporting & Export"

**Requirements:**
- [ ] POST /scenarios/:id/report — Generate PDF report
- [ ] Use pdfkit or puppeteer to create client-ready PDF with:
  - Client name, date, scenario name
  - Strategy summary (investment amount, loan, expected return)
  - 20-year projection table (year, wealth, loan, dividend, tax)
  - Projection chart (Recharts-style visualization)
  - Tax implications summary
  - Disclaimer (not financial advice, consult advisor)
- [ ] Store PDF in S3, return download URL
- [ ] Implement template system (allow customization per customer later)
- [ ] Write tests: generate PDF, verify content, verify S3 upload (Jest, 8+ cases)

**Acceptance Criteria:**
- [x] PDF generates in <2 seconds
- [x] All data fields populated correctly
- [x] PDF S3 URL valid and downloadable
- [x] PDF is client-ready (professional format, no debug data)

**Deliverable:** PDF report generation API

---

### Task: excel_export
**Goal:** Excel export with formulas for advisor flexibility
**Spec Section:** spec/05_dashboard_saas.md — "Reporting & Export"

**Requirements:**
- [ ] POST /scenarios/:id/export — Generate Excel file
- [ ] Use exceljs to create workbook with:
  - Scenario parameters (input sheet)
  - Projection data (output sheet, 20 years)
  - Formulas for XIRR, total tax, wealth gain (allow advisor to modify inputs)
  - Professional formatting (headers, colors, number formats)
  - Data validation (prevent invalid inputs in parameters sheet)
- [ ] Store Excel in S3, return download URL
- [ ] Write tests: generate Excel, verify formulas calculate correctly (Jest, 8+ cases)

**Acceptance Criteria:**
- [x] Excel generates in <2 seconds
- [x] Formulas calculate correctly when inputs modified
- [x] Excel is usable (not corrupted, opens in Excel/Google Sheets)
- [x] S3 URL valid and downloadable

**Deliverable:** Excel export API with formulas

---

### Task: email_integration
**Goal:** Send reports to clients via email
**Spec Section:** spec/05_dashboard_saas.md — "Reporting & Export"

**Requirements:**
- [ ] POST /scenarios/:id/email — Send report to client
- [ ] Use AWS SES to send email with:
  - Report PDF as attachment (or link to S3)
  - Professional template (HTML email)
  - Client portal invitation link (if first email)
  - CTA: "Review your strategy in the client portal"
- [ ] Implement email scheduling (send now, or schedule for specific date/time)
- [ ] Create email_log table (scenario_id, client_email, sent_at, status)
- [ ] Implement bounce handling (SES notifications)
- [ ] Write tests: send email, verify SES called, verify tracking (Jest, 8+ cases)

**Acceptance Criteria:**
- [x] Email sends successfully via SES
- [x] Attachment/link included in email
- [x] Email tracked in email_log
- [x] Bounces handled (removed from mailing list)

**Deliverable:** Email integration for report distribution

---

## WEEK 4 — Billing & Stripe Integration

### Task: stripe_setup
**Goal:** Stripe integration for subscription billing
**Spec Section:** spec/05_dashboard_saas.md — "Pricing Model"

**Requirements:**
- [ ] Create Stripe products for tiers (Starter $500/mo, Pro $1,500/mo, Enterprise custom)
- [ ] POST /billing/subscription — Create subscription (customer_id, tier)
- [ ] Use Stripe Billing Portal for self-serve management (cancel, upgrade, billing history)
- [ ] Implement webhook handler for Stripe events:
  - invoice.paid → Update subscription status
  - charge.failed → Notify customer, disable access
  - customer.subscription.deleted → Clean up customer data
- [ ] Store stripe_customer_id, stripe_subscription_id in customers table
- [ ] Write tests: create subscription, handle webhook, verify database updated (Jest, 10+ cases)

**Acceptance Criteria:**
- [x] All Stripe tests pass (use test API key)
- [x] Subscription created in Stripe
- [x] Webhook handler working correctly
- [x] Billing Portal accessible to customers

**Deliverable:** Stripe subscription integration

---

### Task: tier_enforcement
**Goal:** Enforce subscription limits per tier
**Spec Section:** spec/05_dashboard_saas.md — "Pricing Model"

**Requirements:**
- [ ] Implement tier limits middleware:
  - Starter: max 10 client portfolios
  - Pro: max 50 client portfolios
  - Enterprise: unlimited
- [ ] POST /clients — Check tier limit before creating client
- [ ] Return 402 (Payment Required) if limit exceeded, with upgrade prompt
- [ ] Implement feature flags per tier:
  - Free/Starter: Basic reports (PDF only)
  - Pro: Advanced reports (PDF, Excel, API)
  - Enterprise: White-label, API, custom integrations
- [ ] Write tests: hit tier limit, verify error response, verify upgrade path (Jest, 8+ cases)

**Acceptance Criteria:**
- [x] Tier limits enforced correctly
- [x] Error messages clear (suggest upgrade)
- [x] Features gated by tier properly
- [x] No way to bypass limits

**Deliverable:** Subscription tier enforcement middleware

---

### Task: analytics_dashboard
**Goal:** Admin analytics dashboard (customer acquisition, retention, revenue)
**Spec Section:** spec/05_dashboard_saas.md — "Success Metrics"

**Requirements:**
- [ ] GET /admin/analytics — Admin-only endpoint returning:
  - Total customers, MRR, ARR
  - Signups last 7/30 days
  - Churn rate (monthly)
  - Tier breakdown (count per tier)
  - Top customers by MRR
- [ ] Use database queries to calculate metrics
- [ ] Implement caching (refresh daily at 2 AM)
- [ ] Write tests: verify calculations are correct (Jest, 6+ cases)

**Acceptance Criteria:**
- [x] All metrics calculate correctly
- [x] Performance acceptable (<1s for full dashboard)
- [x] Admin-only access enforced
- [x] Ready for frontend dashboard display

**Deliverable:** Admin analytics API

---

## WEEK 5 — Frontend & Client Portal

### Task: react_frontend_setup
**Goal:** React frontend scaffolding and authentication UI
**Spec Section:** spec/05_dashboard_saas.md — "Frontend"

**Requirements:**
- [ ] Create React app (CRA or Vite)
- [ ] Setup: TailwindCSS, Headless UI, React Query, React Router
- [ ] Create authentication pages:
  - Signup form (email, password, company name)
  - Login form (email, password)
  - Password reset flow
  - Dashboard home page (redirect to clients list)
- [ ] Implement JWT token storage (localStorage or secure cookie)
- [ ] Setup API client (axios or fetch) with auth headers
- [ ] Write tests: signup, login, token storage (React Testing Library, 10+ cases)

**Acceptance Criteria:**
- [x] All auth pages render correctly
- [x] Form validation working
- [x] Tokens stored securely
- [x] API calls include auth header

**Deliverable:** React frontend with authentication UI

---

### Task: dashboard_ui
**Goal:** Advisor dashboard UI (clients list, scenarios, analytics)
**Spec Section:** spec/05_dashboard_saas.md — "Core Features"

**Requirements:**
- [ ] Create Dashboard page layout:
  - Left sidebar: Clients, Reports, Settings, Help
  - Main area: Analytics cards (Total clients, Total assets, Projected gain)
  - Clients table (sortable, searchable, pagination)
  - Quick actions: Add client, Import clients, View reports
- [ ] Create Clients page:
  - Table of clients (name, email, income, risk profile)
  - Edit client modal
  - Delete client with confirmation
  - Bulk import button (CSV)
- [ ] Create Analytics page:
  - Key metrics cards (total clients, assets, projected gain)
  - Charts: Clients over time (line), Tier breakdown (pie)
- [ ] Write tests: render pages, interact with tables, modals (React Testing Library, 15+ cases)

**Acceptance Criteria:**
- [x] All pages render without errors
- [x] Tables functional (sort, search, paginate)
- [x] Modals work (open, close, submit)
- [x] Charts display correctly

**Deliverable:** Advisor dashboard UI

---

### Task: scenarios_ui
**Goal:** Scenario creation and management UI
**Spec Section:** spec/05_dashboard_saas.md — "Debt Recycling Scenarios"

**Requirements:**
- [ ] Create Scenario form:
  - Fields: Client (dropdown), Name, Investment amount, Loan amount, Expected return, Interest rate, Projection years
  - Client validation (must belong to user's workspace)
  - Form validation, error messages
  - Submit button (disabled while loading)
- [ ] Display scenario results:
  - 20-year projection table
  - Recharts visualization: Wealth over time, Loan balance, Tax
  - Key metrics: Total gain, XIRR, final wealth
  - Action buttons: Edit, Delete, Export (PDF/Excel), Email to client
- [ ] Scenario list page:
  - Table of scenarios (client name, scenario name, creation date, wealth gain)
  - Filter by client, sort by date/gain
  - Delete with confirmation
- [ ] Write tests: create scenario, display results, edit scenario (React Testing Library, 15+ cases)

**Acceptance Criteria:**
- [x] All pages render without errors
- [x] Form validation working
- [x] Charts render correctly (check axes, data points)
- [x] Action buttons functional

**Deliverable:** Scenario management UI

---

### Task: client_portal
**Goal:** Read-only client portal (clients view their strategies)
**Spec Section:** spec/05_dashboard_saas.md — "Client Portal"

**Requirements:**
- [ ] Create Client Portal pages:
  - Login (separate from advisor login, using email link)
  - Dashboard: Assigned scenarios (read-only), Performance tracking
  - Scenario detail: View projection chart, download report, contact advisor
  - Notifications: Email alerts (new scenario, monthly updates)
- [ ] Implement read-only enforcement:
  - No edit buttons on client portal
  - API returns 403 if client tries to modify data
- [ ] Create email invitation flow:
  - POST /clients/:id/invite — Generate magic link
  - Client clicks link, portal login (no password)
  - Link expires after 7 days
- [ ] Write tests: login via magic link, view scenarios, verify read-only (React Testing Library, 10+ cases)

**Acceptance Criteria:**
- [x] Client portal renders without errors
- [x] Magic link authentication works
- [x] Scenarios are read-only
- [x] Charts display correctly

**Deliverable:** Read-only client portal

---

### Task: chrome_mcp_verification
**Goal:** Chrome MCP verification (V1-V6 tests for complete workflow)
**Spec Section:** spec/05_dashboard_saas.md — "Chrome MCP Verification Pattern"

**Requirements:**
- [ ] Create scripts/verify-dashboard.js with Chrome MCP verification functions:

**V1: Dashboard Authentication & Access**
  - [ ] Sign up as new advisor
  - [ ] Login with email/password
  - [ ] Access dashboard (verify workspace visible)
  - [ ] Add team member, verify roles enforced

**V2: Client Management**
  - [ ] Create client (name, email, dob, income, profile)
  - [ ] Edit client details
  - [ ] Bulk import 10 clients via CSV
  - [ ] Verify client list displays all clients correctly

**V3: Scenario Creation & Calculation**
  - [ ] Create scenario (investment amount, loan amount, expected return, etc.)
  - [ ] Verify calculation returns correct projection
  - [ ] Verify scenario saves and can be retrieved
  - [ ] Edit scenario parameters, recalculate

**V4: Report Generation & Export**
  - [ ] Generate PDF report from scenario
  - [ ] Download Excel export
  - [ ] Verify PDF contains all required sections
  - [ ] Verify Excel has formulas

**V5: Subscription & Billing**
  - [ ] Create subscription (Starter tier via Stripe)
  - [ ] Verify tier limits enforced (can't add >10 clients)
  - [ ] Upgrade to Pro tier
  - [ ] Verify can now add more clients

**V6: End-to-End Workflow**
  - [ ] Full journey: signup → add client → create scenario → export report → send to client → client views portal
  - [ ] Verify no data loss, all features work
  - [ ] Verify email sent to client
  - [ ] Client can login and view scenario (read-only)

- [ ] Export verification results to stdout
- [ ] Exit code 0 = all tests passed, 1 = any failed
- [ ] Document test execution: `PRODUCTION_URL=https://app.debt-recycler-au.com node scripts/verify-dashboard.js`

**Acceptance Criteria:**
- [x] All V1-V6 verification tests pass
- [x] Tests are repeatable (idempotent)
- [x] Tests complete in <5 minutes
- [x] Verification script committed to repo

**Deliverable:** Chrome MCP verification suite for Dashboard SaaS

---

## DEPLOYMENT & VALIDATION

### Task: deployment_setup
**Goal:** Deploy to production (CloudFront + S3 frontend, Lambda + RDS backend)
**Spec Section:** spec/05_dashboard_saas.md — "Technical Architecture"

**Requirements:**
- [ ] Build React frontend: npm run build → client/build
- [ ] Deploy frontend to S3 (s3://app-debt-recycler-au-frontend)
- [ ] Setup CloudFront distribution (HTTPS, cache headers)
- [ ] Deploy Lambda functions (calculation engine, API endpoints)
- [ ] Configure API Gateway (routes to Lambda)
- [ ] Setup RDS PostgreSQL (multi-AZ, daily backups)
- [ ] Setup SES for emails (verify domain)
- [ ] Configure environment variables (prod API keys)
- [ ] Run Chrome MCP verification against production
- [ ] Document deployment process in DEPLOYMENT.md

**Acceptance Criteria:**
- [x] Frontend accessible via CloudFront HTTPS
- [x] API endpoints respond correctly
- [x] Database connected, data persists
- [x] All Chrome MCP tests pass
- [x] No console errors in browser

**Deliverable:** Production deployment, verified

---

## Notes for Ralph Loop

**Rate Limiting:**
- Min gap between tasks: 90 seconds
- Max 8 tasks per hour, 30 per day
- Exponential backoff on 429 responses

**Task Dependencies:**
- auth_setup must complete before workspace_crud
- db_schema must complete before client_crud
- All backend tasks must complete before react_frontend_setup
- All Week 1-5 tasks must complete before deployment_setup

**Verification:**
- Run `npm test` after each backend task
- Run `npm run build` after each frontend task
- All tests must pass before marking task complete

**Review Process:**
1. After each task, check for linter errors: `npm run lint`
2. After Week 3-5, create draft PR with changes
3. Run Chrome MCP verification suite before marking PR ready

**If Task Fails:**
- Read error output carefully
- Identify root cause
- Fix and retry: `python3 scripts/ralph_loop.py --retry-failed --task task_name`
- If still failing, escalate to user with error log

---

**Ralph Loop Ready!** 🚀
Start with: `python3 scripts/ralph_loop.py --dry-run` to list tasks
Then: `python3 scripts/ralph_loop.py` to begin autonomous implementation
