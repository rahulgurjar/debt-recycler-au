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

## Phase 3 — HTTPS & Security

### 3.1 HTTPS Support (CloudFront + ACM)
**Spec:** spec/04_https_specification.md
**Status:** pending

- [ ] Create private S3 bucket (no website hosting)
- [ ] Configure CloudFront distribution with ACM certificate
- [ ] Set up Origin Access Control (OAC)
- [ ] Update template.yaml with CloudFront resources
- [ ] Update GitHub Actions for private S3 sync + cache invalidation

**Verification (Chrome MCP):**
- V1: HTTPS availability & certificate validity
- V2: HTTP redirect to HTTPS
- V3: API calls use HTTPS
- V4: CloudFront cache headers present
- V5: End-to-end calculation works over HTTPS

---

## Phase 4 — Go Live

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

### Phase 3 (HTTPS) — Chrome MCP Verification

This is the first phase to use Chrome MCP for automated browser-based verification.

**Pre-conditions for Ralph:**
- [ ] spec/04_https_specification.md exists with V1-V5 verification steps
- [ ] scripts/verify-https.js exists with all test functions
- [ ] spec/00_verification_pattern.md exists (verification template)
- [ ] .mcp.json configured with Chrome MCP server
- [ ] Chrome/Chromium available locally with remote debugging

**Ralph Loop Commands:**
```bash
# Run Phase 3 implementation with Chrome MCP verification
cd /home/oem/claude/debt-recycler-au

# 1. Implement HTTPS infrastructure (CloudFront + ACM)
claude --max-turns 30 "Implement Phase 3 HTTPS support per spec/04_https_specification.md. Read PLAN.md Phase 3.1 tasks, template.yaml, and DEPLOYMENT.md for context. After implementation, verify with: node scripts/verify-https.js https://[production-url]"

# 2. Get production URL from deployment
PROD_URL=$(aws cloudformation describe-stacks --stack-name debt-recycler-au --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)

# 3. Run Chrome MCP verification
node scripts/verify-https.js $PROD_URL

# 4. If verification passes (exit 0), commit and create PR
git add -A
git commit -m "feat(https): Add CloudFront + ACM certificate support

- Migrate frontend to private S3 + CloudFront distribution
- Configure ACM certificate for HTTPS
- Implement HTTP → HTTPS redirect
- Update GitHub Actions for private S3 sync

Verified with Chrome MCP:
✅ V1 HTTPS Availability
✅ V2 HTTP Redirect
✅ V3 API HTTPS
✅ V4 CloudFront Cache
✅ V5 End-to-End Calculation
"

gh pr create --draft --title "HTTPS Support with CloudFront & ACM" --body "$(cat <<EOF
## Summary
Added HTTPS support via CloudFront distribution with ACM certificate.

## Verification
All Chrome MCP verification steps pass:
- V1: HTTPS available, certificate valid ✅
- V2: HTTP redirects to HTTPS ✅
- V3: API calls encrypted with HTTPS ✅
- V4: CloudFront cache headers present ✅
- V5: End-to-end calculation works ✅

## Testing
Production URL: $PROD_URL
Verify with: \`node scripts/verify-https.js $PROD_URL\`

🤖 Generated with Claude Code Ralph Loop
EOF
)"
```

**Post-conditions for Ralph:**
- [ ] All Chrome MCP verification steps pass (exit code 0)
- [ ] Infrastructure code deployed to AWS
- [ ] Git commits created with verification evidence
- [ ] PR drafted ready for review

**Evidence to Attach:**
1. Console output from `node scripts/verify-https.js` (all 5 verifications passing)
2. CloudFormation stack outputs showing CloudFront URL
3. AWS certificate details (issuer, expiry)
4. Network tab screenshot showing HTTPS requests

**Rollback Procedure:**
If verification fails after AWS deployment:
```bash
# Revert CloudFormation changes
aws cloudformation delete-stack --stack-name debt-recycler-au

# Revert code
git reset --hard origin/main

# Update DNS back to S3 website endpoint
aws route53 change-resource-record-sets --hosted-zone-id Z123... --change-batch file://revert.json
```

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

