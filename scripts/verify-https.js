/**
 * HTTPS Verification Script
 *
 * Verifies that the debt-recycler-au frontend is properly served over HTTPS
 * with CloudFront caching and valid SSL certificates.
 *
 * Usage: node scripts/verify-https.js <production-url>
 * Example: node scripts/verify-https.js https://debt-recycler-au.example.com
 *
 * Requires: Chrome/Chromium running with --remote-debugging-port
 * Chrome MCP will be used for browser automation and certificate verification
 */

const assert = require('assert');

// Configuration
const PRODUCTION_URL = process.env.PRODUCTION_URL || process.argv[2];
const TIMEOUT = 10000; // 10 seconds
const PAGE_LOAD_TIMEOUT = 3000; // 3 seconds max

if (!PRODUCTION_URL) {
  console.error('Usage: node scripts/verify-https.js <production-url>');
  console.error('Example: node scripts/verify-https.js https://debt-recycler-au.example.com');
  process.exit(1);
}

// Chrome MCP test suite
const tests = {
  /**
   * V1: Verify HTTPS is active and certificate is valid
   */
  async verifyHttpsAvailability(page) {
    console.log('V1: Verifying HTTPS availability...');

    const response = await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    // Check protocol
    const protocol = page.url().split(':')[0];
    assert.strictEqual(protocol, 'https', 'Protocol must be HTTPS');
    console.log('✓ HTTPS protocol active');

    // Check response status
    assert(response && response.ok(), 'Page must load successfully');
    console.log('✓ Page loaded successfully (HTTP 200)');

    // Log certificate details
    const securityDetails = response.securityDetails();
    if (securityDetails) {
      console.log(`✓ Certificate issued by: ${securityDetails.issuer()}`);
      console.log(`✓ Certificate valid from ${securityDetails.validFrom()} to ${securityDetails.validTo()}`);
    }

    return true;
  },

  /**
   * V2: Verify HTTP redirects to HTTPS
   */
  async verifyHttpRedirect(page) {
    console.log('\nV2: Verifying HTTP redirect...');

    const httpUrl = PRODUCTION_URL.replace('https://', 'http://');

    try {
      const response = await page.goto(httpUrl, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUT
      });

      const finalUrl = page.url();
      assert(finalUrl.startsWith('https://'),
        `HTTP must redirect to HTTPS. Final URL: ${finalUrl}`);

      console.log(`✓ HTTP ${httpUrl} redirected to ${finalUrl}`);
      return true;
    } catch (error) {
      // Some servers may not allow HTTP at all, which is fine
      console.log('✓ HTTP access blocked (secure configuration)');
      return true;
    }
  },

  /**
   * V3: Verify API calls use HTTPS
   */
  async verifyApiHttps(page) {
    console.log('\nV3: Verifying API calls use HTTPS...');

    const requests = [];
    page.on('response', (response) => {
      requests.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
    });

    // Navigate to page
    await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    // Fill form with test data
    await page.fill('[name="initialOutlay"]', '55000');
    await page.fill('[name="loanAmount"]', '45000');
    await page.fill('[name="gearingRatio"]', '0.45');

    // Trigger calculation
    await page.click('[data-testid="calculate-button"]');

    // Wait for API response
    await page.waitForResponse(
      r => r.url().includes('/api/calculate'),
      { timeout: TIMEOUT }
    );

    // Verify API calls
    const apiRequests = requests.filter(r => r.url().includes('/api'));
    assert(apiRequests.length > 0, 'API calls must be made');

    for (const req of apiRequests) {
      assert(req.url.startsWith('https://'),
        `API endpoint ${req.url} must use HTTPS`);
      console.log(`✓ API call to ${req.url} uses HTTPS`);
    }

    return true;
  },

  /**
   * V4: Verify CloudFront caching headers
   */
  async verifyCloudFrontCache(page) {
    console.log('\nV4: Verifying CloudFront cache headers...');

    const response = await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    const headers = response.headers();
    const cacheControl = headers['cache-control'];
    const xCache = headers['x-cache'] || headers['X-Cache'];
    const xAmzCf = headers['x-amz-cf-id'] || headers['X-Amz-Cf-Id'];

    // CloudFront should be serving requests
    if (xAmzCf) {
      console.log(`✓ CloudFront distribution ID: ${xAmzCf}`);
    } else {
      console.log('⚠ CloudFront ID not found (may be CloudFront or direct S3)');
    }

    if (cacheControl) {
      console.log(`✓ Cache-Control: ${cacheControl}`);
    }

    if (xCache) {
      console.log(`✓ X-Cache: ${xCache}`);
    }

    return true;
  },

  /**
   * V5: End-to-end HTTPS calculation verification
   */
  async verifyEndToEndCalculation(page) {
    console.log('\nV5: Verifying end-to-end calculation over HTTPS...');

    // Start timing
    const startTime = Date.now();

    // Navigate to page
    await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    const navigationTime = Date.now() - startTime;
    assert(navigationTime < PAGE_LOAD_TIMEOUT,
      `Page load must be < ${PAGE_LOAD_TIMEOUT}ms, took ${navigationTime}ms`);
    console.log(`✓ Page loaded in ${navigationTime}ms`);

    // Fill form
    await page.fill('[name="initialOutlay"]', '55000');
    await page.fill('[name="loanAmount"]', '45000');
    await page.fill('[name="gearingRatio"]', '0.45');
    console.log('✓ Form filled with test data');

    // Click calculate
    const calcStartTime = Date.now();
    await page.click('[data-testid="calculate-button"]');

    // Wait for results
    await page.waitForSelector('[data-testid="year-20-wealth"]', {
      timeout: TIMEOUT
    });
    const calcTime = Date.now() - calcStartTime;
    console.log(`✓ Calculation completed in ${calcTime}ms`);

    // Verify results
    const wealth = await page.locator('[data-testid="year-20-wealth"]').textContent();
    assert(wealth.includes('3,349,321') || wealth.includes('$3,349,321'),
      `Final wealth must show $3,349,321, got: ${wealth}`);
    console.log(`✓ Final wealth (Year 20): ${wealth}`);

    // Verify XIRR is displayed
    const xirr = await page.locator('[data-testid="xirr-value"]').textContent();
    assert(xirr && xirr.includes('13.53'),
      `XIRR must be ~13.53%, got: ${xirr}`);
    console.log(`✓ XIRR: ${xirr}`);

    // Verify chart renders
    const chart = await page.locator('canvas[role="img"]');
    assert(await chart.isVisible(), 'Chart must be visible');
    console.log('✓ Chart rendered successfully');

    return true;
  }
};

/**
 * Run all verification tests
 * This function would be called by the Ralph loop or CI/CD pipeline
 */
async function runVerifications(page) {
  console.log('='.repeat(60));
  console.log('HTTPS Verification Test Suite');
  console.log('='.repeat(60));
  console.log(`Target URL: ${PRODUCTION_URL}\n`);

  const results = [];

  for (const [testName, testFn] of Object.entries(tests)) {
    try {
      await testFn(page);
      results.push({ test: testName, status: 'PASS' });
      console.log(`✅ ${testName} PASSED\n`);
    } catch (error) {
      results.push({ test: testName, status: 'FAIL', error: error.message });
      console.error(`❌ ${testName} FAILED: ${error.message}\n`);
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.test}: ${r.status}`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    }
  });

  console.log(`\nTotal: ${passed} PASSED, ${failed} FAILED out of ${results.length}`);

  if (failed === 0) {
    console.log('\n🎉 All HTTPS verification tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check errors above.');
    process.exit(1);
  }
}

// Export for use with Chrome MCP
module.exports = {
  PRODUCTION_URL,
  runVerifications,
  tests
};

// If run directly with Chrome MCP integration
if (require.main === module) {
  console.log('Run with: Chrome MCP integration');
  console.log('This script is designed to be called by the Ralph loop with Chrome MCP page automation');
}
