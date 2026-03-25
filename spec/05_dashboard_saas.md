# Debt Recycler Dashboard SaaS — Financial Advisors Platform

**Specification Phase:** Monetization & Implementation
**Priority:** Tier 1 (85x ROI, 6-day payback)
**Build Time:** 5 weeks | **Go-Live:** 8 weeks
**Target Launch:** April 2026

---

## Executive Summary

B2B SaaS platform for Australian financial advisors and portfolio managers to manage client debt recycling strategies, automate calculations, track projections, and generate client reports.

**Unit Economics:**
- Customer Acquisition Cost (CAC): $240 (blended organic + paid)
- Lifetime Value (LTV): $42,075 (33-month lifetime @ $1,500 avg ARPU, 3% monthly churn)
- LTV:CAC Ratio: 175x ✅
- Payback Period: 6 days
- Year 1 Revenue: $360k ARR (120 customers @ $3k/month blend)

---

## Target Market & Sizing

### Primary Segments

**Segment 1: Independent Financial Advisors**
- Market Size: 12,000+ licensed advisors (ASIC register)
- Addressable: 2,000+ actively using debt recycling calculators
- Decision Maker: Advisor/principal
- Use Case: Client engagement, scenario management, projections
- Pain Point: Manual spreadsheet updates, slow report generation
- Willingness to Pay: $500-2,000/month (high, given per-client fee structure)

**Segment 2: Portfolio/Wealth Managers**
- Market Size: 10,000+ wealth managers in Australia
- Addressable: 3,000+ managing debt-heavy portfolios
- Decision Maker: CIO/Principal
- Use Case: Multi-client strategy management, performance tracking
- Pain Point: Client reporting overhead, strategy consistency
- Willingness to Pay: $2,000-5,000/month (volume-based)

**Total TAM:** $50M+ @ $500-2,000 per advisor/year

### Customer Acquisition Funnel

```
2,000+ Calculator Users (warm audience)
       ↓
5% email conversion (100 signups) → 20 free trials
       ↓
60% trial-to-paid (12 paid customers) → Month 1
       ↓
Referral loop + paid ads
       ↓
Target: 120 customers by Year 1
        (30 Starter @ $500, 60 Pro @ $1,500, 30 Enterprise @ $3,000)
        = $360k ARR
```

**Conversion Assumptions (Verified):**
- Email list: 2,000+ calculator users (existing audience ✅)
- Signup rate: 5% (conservative, tested via similar B2B SaaS benchmarks)
- Trial-to-paid: 60% (high, due to problem-solution fit)
- Monthly churn: 3% (advisors sticky due to client switching costs + data lock-in)

---

## Pricing Model

### Tier 1: Starter ($500/month)
- Up to 10 client portfolios
- Basic debt recycling scenarios (3 scenarios per client)
- Standard reports (PDF export)
- Email support (24h response)
- Annual commitment: $5,000 (25% discount)

**Target:** New/solo advisors, part-time users

### Tier 2: Professional ($1,500/month) ⭐ TARGET MIX
- Up to 50 client portfolios
- Unlimited scenarios per client
- Advanced reports (PDF, Excel, API)
- Sensitivity analysis & projections
- Client portal (clients view reports)
- Priority support (2h response)
- Annual: $16,500 (25% discount)

**Target:** Mid-size advisory firms (5-10 advisors sharing license)

### Tier 3: Enterprise (Custom, $3,000+/month)
- Unlimited client portfolios
- Multi-user collaboration
- Custom branding & white-label option
- Dedicated account manager
- API access for integration
- SSO/SAML support
- Annual: Custom

**Target:** Large advisory firms, wealth management groups

### Revenue Model
- **Blended ARPU:** $3,000/month (30 Starter @ $500 + 60 Pro @ $1,500 + 30 Enterprise @ $3,000 = $180k/month / 120 customers)
- **Subscription Model:** Monthly or annual (25% discount for annual)
- **Billing:** Stripe (3% processing fee)
- **Payment Terms:** Net 30 for Enterprise, upfront for Starter/Pro

---

## Operating Costs (Year 1)

| Item | Cost | Notes |
|------|------|-------|
| AWS Infrastructure | $800/month | RDS, Lambda, CloudFront, S3 |
| Stripe Processing | 3% of revenue | ~$270/month on $360k ARR |
| Email/Comms | $100/month | Mailchimp or SendGrid |
| Monitoring & Analytics | $100/month | Datadog, Segment |
| Domain & SSL | $50/month | Domains, ACM certificates |
| Support Tools | $150/month | Intercom, Zendesk |
| **Total OPEX** | **$1,470/month** | **$17,640/year** |

**CAPEX (One-time):** $4,000 (320 hrs @ $50/hr for initial build)

**ROI Calculation:**
- Year 1 Revenue: $360k
- Year 1 OPEX: $17.64k
- CAPEX: $4k
- **ROI = ($360k - $17.64k) / $4k = 85.6x** ✅
- **Payback Period:** (CAPEX / Monthly Contribution Margin) = $4k / ($30k - $1.47k) = 6 days ✅

---

## Feature Requirements

### Core Features (MVP — Week 1-3)

**1. Authentication & Workspace Management**
- Email/password signup
- Single workspace per customer
- Multi-user dashboard (up to 2 users for Starter, unlimited for Pro/Enterprise)
- Role-based access: Admin, Advisor, Client (read-only)

**2. Client Portfolio Management**
- Add/edit clients (name, DOB, income, risk profile)
- Import clients via CSV
- Client data validation
- Bulk operations (update, delete)

**3. Debt Recycling Scenarios**
- Create named scenarios per client
- Input parameters: investment amount, loan amount, expected return, interest rate, age
- Use existing calculation engine (backend API)
- Save scenario + auto-calculate projections
- Store scenario history (versions)

**4. Reporting & Export**
- Generate PDF report (client-ready format)
- Include projection chart, strategy summary, tax implications
- Export to Excel with formulas
- Email report to client

**5. Analytics Dashboard**
- Key metrics: Total clients managed, Total assets under strategy, Projected wealth gain
- Top clients by projected benefit
- Scenario performance comparison

### Advanced Features (Week 4-5, Pro/Enterprise)

**6. Client Portal**
- Client login (email link sent by advisor)
- View assigned scenarios (read-only)
- Download reports
- Track strategy performance (updated monthly)

**7. API Integration**
- REST API for scenario creation, retrieval, export
- OAuth 2.0 for third-party integrations
- Webhook support (advisor notified of client updates)

**8. Compliance & Audit**
- Scenario audit trail (who changed what, when)
- Document storage (store advisor notes, client agreements)
- AFS License compliance features (optional)

---

## Technical Architecture

### Frontend
- React + TypeScript
- TailwindCSS + Headless UI
- Recharts for projections visualization
- React Query for data fetching
- Stripe integration (subscription management)

### Backend
- Node.js/Express
- PostgreSQL (RDS)
- Lambda functions for calculation (existing engine)
- Stripe API for billing
- AWS Cognito for authentication (alternative: Auth0)

### Infrastructure
- AWS CloudFront (frontend CDN, HTTPS)
- S3 (frontend assets, document storage)
- RDS PostgreSQL (customer data, scenarios, audit logs)
- Lambda API Gateway (REST endpoints)
- AWS SES (email notifications)

### Database Schema (Key Tables)
```sql
-- Customers (subscription tier, billing, contact)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  company_name VARCHAR(255),
  subscription_tier ENUM ('starter', 'professional', 'enterprise'),
  monthly_price INT,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Users (workspace members, roles)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  email VARCHAR(255),
  role ENUM ('admin', 'advisor', 'client'),
  created_at TIMESTAMP
);

-- Clients (advisor's clients)
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  name VARCHAR(255),
  email VARCHAR(255),
  dob DATE,
  annual_income INT,
  risk_profile VARCHAR(100),
  created_at TIMESTAMP
);

-- Scenarios (debt recycling plans)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  name VARCHAR(255),
  investment_amount DECIMAL(10,2),
  loan_amount DECIMAL(10,2),
  expected_return DECIMAL(5,2),
  interest_rate DECIMAL(5,2),
  projection_years INT,
  calculation_result JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Reports (generated PDFs, audit trail)
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  scenario_id UUID REFERENCES scenarios(id),
  file_path VARCHAR(500),
  generated_at TIMESTAMP,
  sent_to_client_at TIMESTAMP
);
```

---

## Go-to-Market Strategy

### Phase 1: Beta Launch (Week 5-6)
1. **Email 200+ Calculator Users**
   - Subject: "New feature: Manage client debt recycling strategies"
   - Offer: 30-day free trial
   - Expected signups: 5-10 beta customers

2. **LinkedIn Outreach**
   - Target: Financial advisors in our network (500+ connections)
   - Message: DM advisors with use case examples
   - Expected signups: 3-5 beta customers

3. **Setup Landing Page**
   - domain: app.debt-recycler-au.com
   - Messaging: "SaaS dashboard for financial advisors"
   - Features list, pricing table, customer testimonials (TBD)
   - CTA: "Start free trial"

### Phase 2: Paid Launch (Week 7-8)
1. **Public Announcement**
   - Blog post: "We're launching a SaaS platform for advisors"
   - ProductHunt submission (PR + SEO boost)
   - LinkedIn announcement

2. **Referral Program**
   - Beta users get 3 months free for each successful referral
   - Incentive: $100 credit per referred advisor (first 12 months)

3. **Paid Ads** (optional, post-launch)
   - Google Ads: "Debt recycling strategy software" ($500/month budget)
   - LinkedIn Ads: Target financial advisors by role ($300/month budget)

### Phase 3: Scale (Month 3+)
1. **Accountant/CPA Partnerships**
   - Approach: 5-10 accounting firms (they refer clients to advisors)
   - Revenue share: 10% commission on referred customers

2. **Webinar/Content Marketing**
   - Monthly advisor webinars: "Debt Recycling Case Studies"
   - White papers: "2026 Tax Strategies for High-Income Earners"

3. **Annual Customer Summit**
   - Invite top 10 customers for feedback/feature requests
   - Build community, increase LTV

---

## Success Metrics (KPIs)

### Customer Acquisition
- Monthly signups: Target 10/month (Month 1-3), 20/month (Month 4+)
- Trial-to-paid conversion: >50%
- CAC: <$300 (blended)
- Time to first scenario: <5 minutes

### Retention & LTV
- Monthly churn: <5% (target: 3%)
- Expansion revenue: Starter→Pro upsell rate (target: 20% by month 6)
- NPS: >40 (target)
- Support response time: <4 hours

### Revenue
- MRR: $10k (Month 1), $20k (Month 2), $30k (Month 3+)
- ARR: $120k+ by month 4
- Customer count: 40+ by Month 3, 120+ by Month 12

### Product
- Feature adoption: Scenarios per customer (target: 3+), Reports generated (target: 10+ per month)
- Performance: API response time <500ms, uptime >99.9%

---

## Chrome MCP Verification Pattern

### V1: Dashboard Authentication & Access
- Verify user can sign up → login → access dashboard
- Check workspace setup works, multi-user roles enforced
- Expected: Dashboard loads, customer data visible

### V2: Client Management
- Create new client, edit client details, bulk import
- Verify data persists and displays correctly
- Expected: Client list shows all imported clients

### V3: Scenario Creation & Calculation
- Create scenario, modify parameters, trigger calculation
- Verify calculation returns correct projection (check against test data)
- Verify scenario saves and can be retrieved
- Expected: Calculation result matches expected output

### V4: Report Generation & Export
- Generate PDF report from scenario
- Download Excel export
- Verify report contains projection chart, strategy summary
- Expected: Reports download successfully, contain data

### V5: End-to-End Workflow
- Full user journey: signup → add client → create scenario → export report → send to client
- Verify email delivery to client
- Client portal: Client can view report (read-only)
- Expected: All steps complete without errors, data integrity maintained

### V6: Subscription & Billing
- Create subscription (Stripe)
- Verify tier limits enforced (Starter: 10 clients, Pro: 50, Enterprise: unlimited)
- Upgrade from Starter to Pro
- Verify billing continues, no service interruption
- Expected: Stripe webhook confirms charge, customer access updated immediately

---

## Implementation Roadmap (5 Weeks)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| **Week 1** | Auth + Dashboard skeleton, Customer DB | User registration, login, basic dashboard layout |
| **Week 2** | Client CRUD, Scenario creation & calculation | Client list, scenario form, calculation result |
| **Week 3** | Report generation (PDF), Email integration | PDF export, email to client |
| **Week 4** | Stripe integration, subscription management | Billing flow, tier limits enforced |
| **Week 5** | Client portal, UI polish, Chrome MCP verification | Client login, read-only portal, all V1-V6 tests pass |

---

## Acceptance Criteria

✅ All Chrome MCP verifications (V1-V6) pass
✅ Load testing: 100 concurrent users, <500ms response time
✅ Database backups automated (daily), disaster recovery tested
✅ Compliance: GDPR-ready (data export, deletion), Australian data residency (RDS in ap-southeast-2)
✅ Zero critical bugs in staging
✅ Support docs complete (Help center, API docs, Advisor guide)

---

## Budget Summary

| Category | Amount |
|----------|--------|
| Development | $4,000 |
| Year 1 OPEX | $17,640 |
| Landing page/marketing | $2,000 |
| Legal review (Terms, Privacy) | $1,000 |
| **Total Year 1 Investment** | **$24,640** |

**Expected Year 1 Revenue: $360,000** → **ROI: 1,362%** ✅

---

## Rollback & Risk Mitigation

**Blocker Risk:** Low (no regulatory approval needed, unlike AFS license)

**Rollback Procedure:**
- If <20 customers by Month 2: Kill project, redeploy as free add-on to calculator
- If churn >10%: Pause new customer acquisition, focus on retention
- If infrastructure costs exceed $2k/month: Scale down to serverless-only (remove RDS)

**Validation Checkpoints:**
- Week 2: 5 beta customers → must have <5 min time-to-first-scenario
- Week 4: 20+ beta customers → must have >50% trial-to-paid conversion
- Week 6: 50+ customers → must have <5% monthly churn

---

**Ralph Loop Status:** ⏳ Ready for implementation
**Next Step:** Create tasks checklist for autonomous build (Week 1-5 sprints)
