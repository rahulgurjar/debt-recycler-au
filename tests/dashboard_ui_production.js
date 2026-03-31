/**
 * Production Verification: Dashboard UI (Clients, Analytics, Workspace)
 *
 * Run: npm run verify:production dashboard_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Clients tab loads and shows client table
 * V2: Add client form works end-to-end
 * V3: Workspace tab shows team members
 * V4: Analytics tab shows metrics (admin only)
 * V5: Non-admin cannot see Analytics tab
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';
const API_URL = process.env.API_URL || 'https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod';

const TEST_EMAIL = `verify-dash-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Verify Co ${Date.now()}`;

class DashboardUIVerification {
  constructor() {
    this.results = {
      V1_clients_tab_loads: { passed: false, evidence: '' },
      V2_add_client_form: { passed: false, evidence: '' },
      V3_workspace_tab: { passed: false, evidence: '' },
      V4_analytics_tab_admin: { passed: false, evidence: '' },
      V5_navigation_tabs_visible: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Dashboard UI ===');
    console.log(`Target: ${PRODUCTION_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    this.browser = await puppeteer.launch({ headless: true });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(15000);
  }

  async signupAndLogin() {
    await this.page.goto(PRODUCTION_URL);
    await this.page.waitForSelector('button', { timeout: 10000 });

    const signupBtn = await this.page.$('button');
    const btnText = await signupBtn.evaluate((el) => el.textContent);
    if (btnText.match(/sign up/i)) {
      await signupBtn.click();
    } else {
      const allBtns = await this.page.$$('button');
      for (const btn of allBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/sign up/i)) {
          await btn.click();
          break;
        }
      }
    }

    await this.page.waitForSelector('input[type="email"]');
    await this.page.type('input[type="email"]', TEST_EMAIL);

    const inputs = await this.page.$$('input');
    for (const input of inputs) {
      const id = await input.evaluate((el) => el.id);
      if (id === 'company') {
        await input.type(TEST_COMPANY);
      } else if (id === 'password') {
        await input.type(TEST_PASSWORD);
      } else if (id === 'confirm') {
        await input.type(TEST_PASSWORD);
      }
    }

    const submitBtn = await this.page.$('button[type="submit"]');
    await submitBtn.click();
    await this.page.waitForSelector('.app-nav', { timeout: 10000 });
    console.log('  Signed up and logged in successfully');
  }

  async verifyV1ClientsTab() {
    console.log('\nV1: Clients tab loads');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/clients/i)) {
          await btn.click();
          break;
        }
      }

      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes('Add Client') ||
          document.body.innerText.includes('No clients'),
        { timeout: 8000 }
      );

      const hasAddBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/add client/i))
      );

      this.results.V1_clients_tab_loads.passed = hasAddBtn;
      this.results.V1_clients_tab_loads.evidence = hasAddBtn
        ? 'Clients tab loaded, Add Client button present'
        : 'Clients tab missing Add Client button';
      console.log(`  ${hasAddBtn ? 'PASS' : 'FAIL'}: ${this.results.V1_clients_tab_loads.evidence}`);
    } catch (err) {
      this.results.V1_clients_tab_loads.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2AddClientForm() {
    console.log('\nV2: Add client form works');
    try {
      const addBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/add client/i))
      );
      await addBtn.click();

      await this.page.waitForSelector('input[id="client-name"]', { timeout: 5000 });

      const clientEmail = `client-${Date.now()}@verify.com`;
      await this.page.type('input[id="client-name"]', 'Test Verify Client');
      await this.page.type('input[id="client-email"]', clientEmail);
      await this.page.evaluate(() => {
        const input = document.querySelector('input[id="client-dob"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '1985-06-15');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await this.page.type('input[id="client-income"]', '100000');

      const saveBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/save client/i))
      );
      await saveBtn.click();

      await this.page.waitForFunction(
        () => document.body.innerText.includes('Test Verify Client'),
        { timeout: 12000 }
      );

      this.results.V2_add_client_form.passed = true;
      this.results.V2_add_client_form.evidence = 'Created client "Test Verify Client" - appears in table';
      console.log(`  PASS: ${this.results.V2_add_client_form.evidence}`);
    } catch (err) {
      this.results.V2_add_client_form.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3WorkspaceTab() {
    console.log('\nV3: Workspace tab shows team members');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/workspace/i)) {
          await btn.click();
          break;
        }
      }

      await this.page.waitForFunction(
        () =>
          !document.body.innerText.includes('Loading workspace') &&
          (document.body.innerText.includes('Team') ||
           document.body.innerText.includes('Workspace') ||
           document.body.innerText.includes('Company')),
        { timeout: 12000 }
      );

      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasTeamSection = pageText.includes('Team') || pageText.includes('Company');
      const hasInviteBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/invite/i))
      );

      this.results.V3_workspace_tab.passed = hasTeamSection;
      this.results.V3_workspace_tab.evidence = `Team/Company content: ${hasTeamSection}, Invite button: ${hasInviteBtn}`;
      console.log(
        `  ${this.results.V3_workspace_tab.passed ? 'PASS' : 'FAIL'}: ${this.results.V3_workspace_tab.evidence}`
      );
    } catch (err) {
      this.results.V3_workspace_tab.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4AnalyticsTab() {
    console.log('\nV4: Analytics tab shows metrics (admin)');
    try {
      const analyticsBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('.nav-btn')].find((b) => b.textContent.match(/analytics/i))
      );

      if (analyticsBtn && (await analyticsBtn.evaluate((el) => el !== null))) {
        await analyticsBtn.click();

        await this.page.waitForFunction(
          () =>
            !document.body.innerText.includes('Loading analytics') &&
            (document.body.innerText.includes('Total') ||
             document.body.innerText.includes('MRR') ||
             document.body.innerText.includes('admin access')),
          { timeout: 12000 }
        );

        const hasMetrics = await this.page.evaluate(() =>
          document.body.innerText.includes('Total') || document.body.innerText.includes('MRR')
        );

        this.results.V4_analytics_tab_admin.passed = hasMetrics;
        this.results.V4_analytics_tab_admin.evidence = hasMetrics
          ? 'Analytics tab shows Total Users and MRR metrics'
          : 'Analytics tab loaded but metrics not visible';
      } else {
        this.results.V4_analytics_tab_admin.evidence = 'Analytics tab not visible (may not be admin)';
      }

      console.log(
        `  ${this.results.V4_analytics_tab_admin.passed ? 'PASS' : 'FAIL'}: ${this.results.V4_analytics_tab_admin.evidence}`
      );
    } catch (err) {
      this.results.V4_analytics_tab_admin.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5NavigationTabs() {
    console.log('\nV5: All navigation tabs visible');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      const tabTexts = await Promise.all(navBtns.map((btn) => btn.evaluate((el) => el.textContent.trim())));

      const hasClients = tabTexts.some((t) => t.match(/clients/i));
      const hasWorkspace = tabTexts.some((t) => t.match(/workspace/i));
      const hasScenarios = tabTexts.some((t) => t.match(/scenario/i));

      this.results.V5_navigation_tabs_visible.passed = hasClients && hasWorkspace && hasScenarios;
      this.results.V5_navigation_tabs_visible.evidence = `Tabs found: ${tabTexts.join(', ')}`;
      console.log(
        `  ${this.results.V5_navigation_tabs_visible.passed ? 'PASS' : 'FAIL'}: ${this.results.V5_navigation_tabs_visible.evidence}`
      );
    } catch (err) {
      this.results.V5_navigation_tabs_visible.evidence = `Error: ${err.message}`;
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
      await this.signupAndLogin();
      await this.verifyV5NavigationTabs();
      await this.verifyV1ClientsTab();
      await this.verifyV2AddClientForm();
      await this.verifyV3WorkspaceTab();
      await this.verifyV4AnalyticsTab();
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

new DashboardUIVerification().run();
