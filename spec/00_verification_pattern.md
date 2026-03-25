# Verification Pattern — Chrome MCP for All Specs

This document defines the standard verification pattern used for all debt-recycler-au specifications starting with Phase 3 (HTTPS).

## Pattern Overview

Each specification includes automated, browser-based verification using Chrome MCP. This replaces manual "click the button and verify" processes with repeatable, automated tests.

## Structure for Each Spec

### 1. Specification Document (`spec/XX_feature_name.md`)

Include these sections:
- **Overview** — What the feature does
- **Requirements** — Functional + Non-functional requirements
- **Verification with Chrome MCP** — Multiple verification steps (V1, V2, V3...)
  - Each step tests one aspect
  - Uses Chrome browser automation (headless)
  - Example code showing assertions and checks
- **Success Criteria** — Acceptance criteria (checklist)

### 2. Verification Script (`scripts/verify-feature.js`)

Implements all verification steps from spec:
- Export `tests` object with each V1, V2, V3 function
- Each test function uses Chrome page automation
- Include assertions for success/failure
- Run as: `node scripts/verify-feature.js <url>`

### 3. Test Execution

Ralph loop runs verification automatically:

```bash
# Phase 3 (HTTPS) example:
node scripts/verify-https.js https://production-domain.com

# Output:
# ✅ V1 HTTPS Availability: PASSED
# ✅ V2 HTTP Redirect: PASSED
# ✅ V3 API HTTPS: PASSED
# ✅ V4 CloudFront Cache: PASSED
# ✅ V5 End-to-End Calculation: PASSED
# 🎉 All HTTPS verification tests PASSED!
```

## Verification Step Guidelines

### V1: Basic Functionality
- Navigation to URL works
- Page loads without errors
- Core elements are visible

**Example (HTTPS):**
```javascript
await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2' });
assert(page.url().includes('https://'));
```

### V2: Protocol/Security
- HTTPS/HTTP behavior correct
- Certificates valid
- Security headers present

**Example (HTTPS):**
```javascript
const response = await page.goto(`http://${domain}`);
const finalUrl = page.url();
assert(finalUrl.startsWith('https://'));
```

### V3: API Integration
- API calls work correctly
- Correct headers/protocols
- Data flows correctly

**Example (HTTPS):**
```javascript
await page.click('[data-testid="calculate-button"]');
await page.waitForResponse(r => r.url().includes('/api/calculate'));
const apiRequests = requests.filter(r => r.url().includes('/api'));
assert(apiRequests[0].url.startsWith('https://'));
```

### V4: Performance/Caching
- Response times acceptable
- Cache headers correct
- CDN working (if applicable)

**Example (HTTPS):**
```javascript
const startTime = Date.now();
await page.goto(PRODUCTION_URL);
const loadTime = Date.now() - startTime;
assert(loadTime < 3000, `Load time ${loadTime}ms exceeds 3s limit`);
```

### V5: End-to-End Workflow
- Complete user flow works
- Results match expected output
- All components integrate

**Example (HTTPS):**
```javascript
await page.fill('[name="initialOutlay"]', '55000');
await page.click('[data-testid="calculate-button"]');
await page.waitForSelector('[data-testid="year-20-wealth"]');
const wealth = await page.locator('[data-testid="year-20-wealth"]').textContent();
assert(wealth.includes('3,349,321'));
```

## Chrome MCP Integration

### What is Chrome MCP?
- **MCP** = Model Context Protocol
- Chrome MCP allows Claude to control Chrome browser via DevTools Protocol
- Can navigate, click, fill forms, read text, monitor network requests

### In Ralph Loop Context
- Ralph calls: `node scripts/verify-feature.js <url>`
- Script uses Puppeteer/Playwright to automate Chrome
- Each test function returns true/throws on assertion failure
- Exit code 0 = all tests pass → ready to merge
- Exit code 1 = test failed → needs fixes

### Requirements
- Chrome or Chromium installed locally
- Puppeteer or Playwright npm package
- Node.js 18+
- Production URL accessible from test environment

## Testing Evidence Format

When verification passes, Ralph should capture:

1. **Console Output** — Raw test results (copy-paste into PR description)
2. **Screenshots** — Optional, for visual confirmation
   - HTTPS lock icon
   - Browser DevTools certificate info
   - Network tab showing requests
3. **Metrics** — Performance numbers from tests
   - Page load time
   - API response time
   - Cache hit rate

## Future Specs Using This Pattern

When creating new specifications (Phase 4+):

1. **Phase 4 — Go Live**: Test prod health checks
   - V1: Lambda endpoint responds
   - V2: Database connectivity
   - V3: API calculation accuracy
   - V4: Error handling
   - V5: Monitoring/alerting

2. **Phase 5 — Analytics**: Add usage tracking
   - V1: Events captured
   - V2: Data persists
   - V3: Queries work
   - V4: Reports generate
   - V5: No performance impact

3. **Phase 6 — Auth**: Add user authentication
   - V1: Login page loads
   - V2: Authentication works
   - V3: Session persists
   - V4: Logout clears session
   - V5: Protected routes blocked without auth

## Common Chrome MCP Patterns

### Navigation with Timeout
```javascript
await page.goto(url, {
  waitUntil: 'networkidle2',
  timeout: 10000
});
```

### Form Interaction
```javascript
await page.fill('[name="fieldName"]', 'value');
await page.click('[data-testid="submit-button"]');
```

### Waiting for Elements
```javascript
await page.waitForSelector('[data-testid="results"]', { timeout: 5000 });
const text = await page.locator('[data-testid="results"]').textContent();
```

### Network Monitoring
```javascript
const requests = [];
page.on('response', (response) => {
  requests.push({
    url: response.url(),
    status: response.status(),
    headers: response.headers()
  });
});
```

### Assertions
```javascript
assert(condition, 'Error message if assertion fails');
assert.strictEqual(actual, expected, 'Detailed error');
assert(array.length > 0, `Expected items, got empty`);
```

## Example: Full Verification Script Template

```javascript
// scripts/verify-feature.js
const assert = require('assert');

const PRODUCTION_URL = process.env.PRODUCTION_URL || process.argv[2];

const tests = {
  async verifyFeatureV1(page) {
    console.log('V1: Verifying basic feature...');
    // Test logic here
    return true;
  },

  async verifyFeatureV2(page) {
    console.log('V2: Verifying feature integration...');
    // Test logic here
    return true;
  }
};

async function runVerifications(page) {
  for (const [testName, testFn] of Object.entries(tests)) {
    try {
      await testFn(page);
      console.log(`✅ ${testName} PASSED`);
    } catch (error) {
      console.error(`❌ ${testName} FAILED: ${error.message}`);
      process.exit(1);
    }
  }
  console.log('\n🎉 All verification tests PASSED!');
  process.exit(0);
}

module.exports = { PRODUCTION_URL, runVerifications, tests };
```

## Running Verifications in Ralph Loop

```bash
# After implementation of spec feature, Ralph runs:
node scripts/verify-https.js https://production-domain.com

# If verification passes (exit 0):
echo "✅ Feature verified. Ready for PR merge."

# If verification fails (exit 1):
echo "❌ Verification failed. Need to debug and retry."
```

## Benefits of This Pattern

1. **Repeatable** — Same test runs identically every time
2. **Autonomous** — No human clicking required
3. **Fast** — Headless Chrome runs in seconds
4. **Evidence** — Full console output shows what was tested
5. **Scalable** — Add more verifications without manual effort
6. **Debuggable** — Clear assertion messages on failure
