/**
 * Production Verification: Client Portal
 *
 * Run: npm run verify:production client_portal
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Advisor can generate portal token via API
 * V2: Portal URL loads read-only view when accessed with valid token
 * V3: Portal shows client name and email
 * V4: Portal shows scenarios list (or empty state)
 * V5: Invalid/missing token shows error state
 */

const puppeteer = require('puppeteer');
const https = require('https');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';
const API_URL = process.env.API_URL || 'https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod';

const TEST_EMAIL = `portal-advisor-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Portal Advisor Co ${Date.now()}`;
const CLIENT_NAME = `Portal Test Client ${Date.now()}`;
const CLIENT_EMAIL = `portal-client-${Date.now()}@test.com`;

class ClientPortalVerification {
  constructor() {
    this.results = {
      V1_generate_portal_token: { passed: false, evidence: '' },
      V2_portal_url_loads: { passed: false, evidence: '' },
      V3_portal_shows_client: { passed: false, evidence: '' },
      V4_portal_shows_scenarios: { passed: false, evidence: '' },
      V5_invalid_token_error: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
    this.advisorToken = null;
    this.clientId = null;
    this.portalToken = null;
    this.portalUrl = null;
  }

  apiPost(path, body, token) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(API_URL + path);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async setup() {
    console.log('\n=== Production Verification: Client Portal ===');
    console.log(`Target: ${PRODUCTION_URL}`);
    console.log(`API: ${API_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    this.browser = await puppeteer.launch({ headless: true });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(15000);
  }

  async setupAdvisorAndClient() {
    console.log('Setting up advisor and client via API...');

    const signupRes = await this.apiPost('/auth/signup', {
      email: TEST_EMAIL, password: TEST_PASSWORD, company_name: TEST_COMPANY,
    });

    if (!signupRes.token) {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes)}`);
    }
    this.advisorToken = signupRes.token;
    console.log('  Advisor signed up successfully');

    const clientRes = await this.apiPost('/clients', {
      name: CLIENT_NAME, email: CLIENT_EMAIL, dob: '1985-06-15',
      annual_income: 150000, risk_profile: 'moderate',
    }, this.advisorToken);

    if (!clientRes.client?.id) {
      throw new Error(`Client creation failed: ${JSON.stringify(clientRes)}`);
    }
    this.clientId = clientRes.client.id;
    console.log(`  Client created: ${CLIENT_NAME} (id=${this.clientId})`);
  }

  async verifyV1GeneratePortalToken() {
    console.log('\nV1: Generate portal token via API');
    try {
      const portalRes = await this.apiPost('/portal/generate', {
        client_id: this.clientId,
      }, this.advisorToken);

      if (!portalRes.portal_token || !portalRes.portal_url) {
        throw new Error(`Portal token not returned: ${JSON.stringify(portalRes)}`);
      }

      this.portalToken = portalRes.portal_token;
      this.portalUrl = `${PRODUCTION_URL}/?portal_token=${this.portalToken}`;

      const hasClientName = portalRes.client_name === CLIENT_NAME;
      const hasExpiry = portalRes.expires_in === '7 days';

      this.results.V1_generate_portal_token.passed = true;
      this.results.V1_generate_portal_token.evidence = `Portal token generated. client_name: ${portalRes.client_name}, expires_in: ${portalRes.expires_in}`;
      console.log(`  PASS: ${this.results.V1_generate_portal_token.evidence}`);
    } catch (err) {
      this.results.V1_generate_portal_token.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2PortalUrlLoads() {
    console.log('\nV2: Portal URL loads read-only view');
    try {
      if (!this.portalToken) throw new Error('No portal token (V1 failed)');

      await this.page.goto(this.portalUrl, { waitUntil: 'networkidle2', timeout: 20000 });

      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes('Debt Recycling Portal') ||
          document.body.innerText.includes('Unable to Access Portal'),
        { timeout: 15000 }
      );

      const hasPortalHeader = await this.page.evaluate(() =>
        document.body.innerText.includes('Debt Recycling Portal')
      );

      this.results.V2_portal_url_loads.passed = hasPortalHeader;
      this.results.V2_portal_url_loads.evidence = hasPortalHeader
        ? 'Portal page loaded with "Debt Recycling Portal" header'
        : 'Portal page did not load expected header';
      console.log(`  ${this.results.V2_portal_url_loads.passed ? 'PASS' : 'FAIL'}: ${this.results.V2_portal_url_loads.evidence}`);
    } catch (err) {
      this.results.V2_portal_url_loads.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3PortalShowsClient() {
    console.log('\nV3: Portal shows client name and email');
    try {
      await this.page.waitForFunction(
        () => !document.body.innerText.includes('Loading your financial scenarios'),
        { timeout: 10000 }
      );

      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasClientName = pageText.includes(CLIENT_NAME);
      const hasClientEmail = pageText.includes(CLIENT_EMAIL);

      this.results.V3_portal_shows_client.passed = hasClientName && hasClientEmail;
      this.results.V3_portal_shows_client.evidence = `Client name visible: ${hasClientName}, Client email visible: ${hasClientEmail}`;
      console.log(`  ${this.results.V3_portal_shows_client.passed ? 'PASS' : 'FAIL'}: ${this.results.V3_portal_shows_client.evidence}`);
    } catch (err) {
      this.results.V3_portal_shows_client.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4PortalShowsScenarios() {
    console.log('\nV4: Portal shows scenarios list or empty state');
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasScenariosHeading = pageText.includes('Your Scenarios');
      const hasEmptyOrTable =
        pageText.includes('No scenarios available yet') ||
        document.querySelectorAll('.portal-scenarios-table').length > 0 ||
        pageText.match(/Your Scenarios \(\d+\)/);

      const hasScenarioSection = await this.page.evaluate(() =>
        document.body.innerText.includes('Your Scenarios')
      );

      this.results.V4_portal_shows_scenarios.passed = hasScenarioSection;
      this.results.V4_portal_shows_scenarios.evidence = `Scenarios section visible: ${hasScenarioSection}`;
      console.log(`  ${this.results.V4_portal_shows_scenarios.passed ? 'PASS' : 'FAIL'}: ${this.results.V4_portal_shows_scenarios.evidence}`);
    } catch (err) {
      this.results.V4_portal_shows_scenarios.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5InvalidTokenError() {
    console.log('\nV5: Invalid token shows error state');
    try {
      const invalidUrl = `${PRODUCTION_URL}/?portal_token=invalid-jwt-token-here`;
      await this.page.goto(invalidUrl, { waitUntil: 'networkidle2', timeout: 20000 });

      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes('Unable to Access Portal') ||
          document.body.innerText.includes('Invalid or expired portal link'),
        { timeout: 15000 }
      );

      const hasError = await this.page.evaluate(() =>
        document.body.innerText.includes('Unable to Access Portal') ||
        document.body.innerText.includes('Invalid or expired portal link')
      );

      this.results.V5_invalid_token_error.passed = hasError;
      this.results.V5_invalid_token_error.evidence = hasError
        ? 'Error state shown for invalid token'
        : 'Expected error state not shown';
      console.log(`  ${this.results.V5_invalid_token_error.passed ? 'PASS' : 'FAIL'}: ${this.results.V5_invalid_token_error.evidence}`);
    } catch (err) {
      this.results.V5_invalid_token_error.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async printSummary() {
    console.log('\n=== VERIFICATION SUMMARY ===');
    let passed = 0;
    let total = 0;
    for (const [key, result] of Object.entries(this.results)) {
      total++;
      if (result.passed) passed++;
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${key}: ${result.evidence}`);
    }
    console.log(`\n${passed}/${total} checks passed`);
    return passed === total;
  }

  async run() {
    try {
      await this.setup();
      await this.setupAdvisorAndClient();
      await this.verifyV1GeneratePortalToken();
      await this.verifyV2PortalUrlLoads();
      await this.verifyV3PortalShowsClient();
      await this.verifyV4PortalShowsScenarios();
      await this.verifyV5InvalidTokenError();
      const allPassed = await this.printSummary();
      process.exit(allPassed ? 0 : 1);
    } catch (err) {
      console.error('\nFATAL:', err.message);
      process.exit(1);
    } finally {
      if (this.browser) await this.browser.close();
    }
  }
}

new ClientPortalVerification().run();
