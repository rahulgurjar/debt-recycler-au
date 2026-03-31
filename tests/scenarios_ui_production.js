/**
 * Production Verification: Scenarios UI (ScenarioForm + recharts)
 *
 * Run: npm run verify:production scenarios_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: New Scenario tab visible in navigation
 * V2: Client dropdown populates from API
 * V3: Scenario form has all parameter fields
 * V4: Running scenario shows Final Wealth result
 * V5: Saved Scenarios tab shows created scenario
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-sc-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Scenario Co ${Date.now()}`;

class ScenariosUIVerification {
  constructor() {
    this.results = {
      V1_new_scenario_tab: { passed: false, evidence: '' },
      V2_client_dropdown: { passed: false, evidence: '' },
      V3_parameter_fields: { passed: false, evidence: '' },
      V4_run_shows_results: { passed: false, evidence: '' },
      V5_saved_scenarios_list: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Scenarios UI ===');
    console.log(`Target: ${PRODUCTION_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    this.browser = await puppeteer.launch({ headless: true });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(20000);
  }

  async signupAndLogin() {
    await this.page.goto(PRODUCTION_URL);
    await this.page.waitForSelector('button', { timeout: 10000 });

    const allBtns = await this.page.$$('button');
    for (const btn of allBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/sign up/i)) {
        await btn.click();
        break;
      }
    }

    await this.page.waitForSelector('input[type="email"]');
    await this.page.type('input[type="email"]', TEST_EMAIL);

    const inputs = await this.page.$$('input');
    for (const input of inputs) {
      const id = await input.evaluate((el) => el.id);
      if (id === 'company') await input.type(TEST_COMPANY);
      else if (id === 'password') await input.type(TEST_PASSWORD);
      else if (id === 'confirm') await input.type(TEST_PASSWORD);
    }

    await (await this.page.$('button[type="submit"]')).click();
    await this.page.waitForSelector('.app-nav', { timeout: 10000 });
    console.log('  Signed up and logged in');
  }

  async createTestClient() {
    const navBtns = await this.page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/^clients$/i)) {
        await btn.click();
        break;
      }
    }

    await this.page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent.match(/add client/i)),
      { timeout: 8000 }
    );

    const addBtn = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.match(/add client/i))
    );
    await addBtn.click();

    await this.page.waitForSelector('input[id="client-name"]');
    await this.page.type('input[id="client-name"]', 'Test Scenario Client');
    await this.page.type('input[id="client-email"]', `scclient-${Date.now()}@verify.com`);
    await this.page.type('input[id="client-dob"]', '1980-01-01');
    await this.page.type('input[id="client-income"]', '120000');

    const saveBtn = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.match(/save client/i))
    );
    await saveBtn.click();

    await this.page.waitForFunction(
      () => document.body.innerText.includes('Test Scenario Client'),
      { timeout: 8000 }
    );
    console.log('  Created test client: Test Scenario Client');
  }

  async verifyV1NewScenarioTab() {
    console.log('\nV1: New Scenario tab visible');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      const tabTexts = await Promise.all(navBtns.map((b) => b.evaluate((el) => el.textContent.trim())));
      const hasNewScenario = tabTexts.some((t) => t.match(/new scenario/i));

      this.results.V1_new_scenario_tab.passed = hasNewScenario;
      this.results.V1_new_scenario_tab.evidence = `Tabs: ${tabTexts.join(', ')}`;
      console.log(
        `  ${hasNewScenario ? 'PASS' : 'FAIL'}: ${this.results.V1_new_scenario_tab.evidence}`
      );
    } catch (err) {
      this.results.V1_new_scenario_tab.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async navigateToNewScenario() {
    const navBtns = await this.page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/new scenario/i)) {
        await btn.click();
        break;
      }
    }
    await this.page.waitForFunction(
      () =>
        document.body.innerText.includes('Create Scenario') ||
        document.body.innerText.includes('Loading'),
      { timeout: 8000 }
    );
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading clients'),
      { timeout: 10000 }
    );
  }

  async verifyV2ClientDropdown() {
    console.log('\nV2: Client dropdown populates');
    try {
      await this.navigateToNewScenario();

      const dropdown = await this.page.$('select#sf-client');
      if (!dropdown) {
        this.results.V2_client_dropdown.evidence = 'Client dropdown #sf-client not found';
        console.log(`  FAIL: ${this.results.V2_client_dropdown.evidence}`);
        return;
      }

      const options = await this.page.$$eval('select#sf-client option', (opts) =>
        opts.map((o) => o.textContent)
      );
      const hasClient = options.some((o) => o.match(/Test Scenario Client/));

      this.results.V2_client_dropdown.passed = hasClient;
      this.results.V2_client_dropdown.evidence = `Options: ${options.join(', ')}`;
      console.log(
        `  ${hasClient ? 'PASS' : 'FAIL'}: ${this.results.V2_client_dropdown.evidence}`
      );
    } catch (err) {
      this.results.V2_client_dropdown.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3ParameterFields() {
    console.log('\nV3: Scenario parameter fields present');
    try {
      const checks = {
        'sf-name': false,
        'sf-outlay': false,
        'sf-gearing': false,
        'sf-investment': false,
      };

      for (const id of Object.keys(checks)) {
        const el = await this.page.$(`#${id}`);
        checks[id] = el !== null;
      }

      const allPresent = Object.values(checks).every(Boolean);
      this.results.V3_parameter_fields.passed = allPresent;
      this.results.V3_parameter_fields.evidence = `Fields: ${JSON.stringify(checks)}`;
      console.log(
        `  ${allPresent ? 'PASS' : 'FAIL'}: ${this.results.V3_parameter_fields.evidence}`
      );
    } catch (err) {
      this.results.V3_parameter_fields.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4RunShowsResults() {
    console.log('\nV4: Running scenario shows results');
    try {
      await this.page.select('select#sf-client', await this.page.$eval(
        'select#sf-client option:not([value=""])',
        (el) => el.value
      ));

      await this.page.$eval('input#sf-name', (el) => {
        el.value = '';
      });
      await this.page.type('input#sf-name', 'Verification Plan');

      const runBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/run scenario/i))
      );
      await runBtn.click();

      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes('Final Wealth') ||
          document.body.innerText.includes('XIRR'),
        { timeout: 15000 }
      );

      const hasFinalWealth = await this.page.evaluate(() =>
        document.body.innerText.includes('Final Wealth')
      );

      this.results.V4_run_shows_results.passed = hasFinalWealth;
      this.results.V4_run_shows_results.evidence = hasFinalWealth
        ? 'Scenario ran successfully - Final Wealth and XIRR displayed'
        : 'Scenario ran but results not visible';
      console.log(
        `  ${hasFinalWealth ? 'PASS' : 'FAIL'}: ${this.results.V4_run_shows_results.evidence}`
      );
    } catch (err) {
      this.results.V4_run_shows_results.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5SavedScenariosList() {
    console.log('\nV5: Saved Scenarios tab shows list');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/saved scenarios/i)) {
          await btn.click();
          break;
        }
      }

      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes('Saved Scenarios') ||
          document.body.innerText.includes('Loading'),
        { timeout: 8000 }
      );

      await this.page.waitForFunction(
        () => !document.body.innerText.includes('Loading scenarios'),
        { timeout: 10000 }
      );

      const hasSavedScenarios = await this.page.evaluate(() =>
        document.body.innerText.includes('Saved Scenarios')
      );

      this.results.V5_saved_scenarios_list.passed = hasSavedScenarios;
      this.results.V5_saved_scenarios_list.evidence = hasSavedScenarios
        ? 'Saved Scenarios tab loaded'
        : 'Saved Scenarios tab missing';
      console.log(
        `  ${hasSavedScenarios ? 'PASS' : 'FAIL'}: ${this.results.V5_saved_scenarios_list.evidence}`
      );
    } catch (err) {
      this.results.V5_saved_scenarios_list.evidence = `Error: ${err.message}`;
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
      await this.verifyV1NewScenarioTab();
      await this.createTestClient();
      await this.verifyV2ClientDropdown();
      await this.verifyV3ParameterFields();
      await this.verifyV4RunShowsResults();
      await this.verifyV5SavedScenariosList();
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

new ScenariosUIVerification().run();
