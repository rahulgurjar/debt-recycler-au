# Development Rules — Debt Recycler AU

## Primary Objective

**Deliver working features in production that independent users can verify.**

All claims about feature functionality MUST be backed by production verification evidence.

## Core Principles

- **Spec-Driven**: Every feature starts with SPEC (success criteria + acceptance tests)
- **Test-First**: Write tests BEFORE code. Tests are source of truth.
- **Production-Verified**: Features deployed to production + verified with Chrome MCP
- **Evidence-Based**: All verification steps documented so others can reproduce
- **Financial Accuracy**: Calculations match spreadsheet model exactly

## Complete Workflow (Per Feature)

### Phase 1: Specification & Testing
1. Write SPEC document with V1-V5 verification requirements
2. Write acceptance tests (25+ test cases)
3. Document expected behavior (inputs/outputs)

### Phase 2: Implementation
4. Write code to pass tests
5. Run full test suite + linter
6. Commit to feature branch with test evidence

### Phase 3: Production Deployment
7. Deploy to production (Lambda + RDS)
8. Verify database migrations ran
9. Verify API endpoints accessible
10. Verify frontend can reach backend

### Phase 4: Production Verification (Chrome MCP)
11. Write Chrome MCP verification script (`tests/{feature}_production.js`)
12. Script verifies all V1-V5 requirements end-to-end
13. Run script: `npm run verify:production {feature}`
14. Capture screenshots/results as evidence

### Phase 5: Documentation
15. Update SPEC with "Production Verification" section
16. Include:
    - Chrome MCP script location
    - Exact steps to reproduce verification
    - Evidence (screenshots, API responses)
    - How independent users can verify
17. Create PR with production verification evidence

### Phase 6: Review & Merge
18. Code review checks:
    - Tests pass ✅
    - Production deployment successful ✅
    - Chrome MCP verification passes ✅
    - Spec includes reproducible verification steps ✅
19. Merge to main

## What "Verified in Production" Means

- Feature works end-to-end in live environment
- Anyone following the documented steps can reproduce verification
- Chrome MCP tests pass against production API
- Evidence (screenshots, API responses) attached to spec
- No mocking or local assumptions

## Chrome MCP Usage (Production Only)

Use Chrome MCP for:
- ✅ Production verification (verify live features work)
- ✅ Document verification steps for others
- ❌ Do NOT use for CI/CD pipeline (use Jest)
- ❌ Do NOT use for local dev environment

## Verification Template (Required in Every Spec)

```markdown
## Production Verification

**Prerequisites:**
- Access to https://d1p3am5bl1sho7.cloudfront.net
- Chrome MCP script available

**Steps:**
```bash
npm run verify:production {feature_name}
```

**Expected Output:**
- ✅ V1: [description of what passes]
- ✅ V2: [description of what passes]
- ✅ V3: [description of what passes]
- ✅ V4: [description of what passes]
- ✅ V5: [description of what passes]

**How Others Can Verify:**
1. [Step 1 for manual verification]
2. [Step 2 for manual verification]
3. [Assertion/screenshot to confirm]

**Evidence:**
[Screenshot of successful execution]
```

## Test Requirements

**Local Tests (Jest):**
- Unit tests for calculations
- Integration tests for API logic
- Minimum 80% code coverage
- All financial calculations verified against spec

**Production Tests (Chrome MCP):**
- End-to-end user workflows
- Login/signup/forms
- Feature access (UI to API)
- Data persistence
- Error handling

## Code Quality Standards

- Match existing patterns
- No hardcoded secrets
- Format with prettier/eslint
- Atomic, well-messaged commits
- All tests passing before PR

## Success Criteria

A feature is DONE when:
1. ✅ SPEC document exists with V1-V5 requirements
2. ✅ 25+ acceptance tests written and passing
3. ✅ Code implements feature (passes tests)
4. ✅ Deployed to production
5. ✅ Chrome MCP verification script passes
6. ✅ SPEC includes "Production Verification" section with reproducible steps
7. ✅ PR includes verification evidence (screenshots, test results)
8. ✅ Anyone can follow SPEC steps and reproduce verification

## Next Feature Checklist

- [ ] SPEC written with clear V1-V5 requirements
- [ ] 25+ test cases covering all requirements
- [ ] Code implementation complete
- [ ] All tests passing locally
- [ ] Deployed to production
- [ ] Chrome MCP verification script written
- [ ] Chrome MCP tests passing against production
- [ ] SPEC updated with "Production Verification" section
- [ ] Evidence captured (screenshots, responses)
- [ ] Others can reproduce verification by following SPEC
- [ ] PR created with all evidence attached
