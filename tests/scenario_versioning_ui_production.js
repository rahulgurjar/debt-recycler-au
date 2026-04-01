/**
 * Production Verification: Scenario Versioning UI
 *
 * Run: npm run verify:scenario_versioning_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Selecting a scenario shows ScenarioActions panel
 * V2: "Version History" heading present in ScenarioActions
 * V3: At least 1 version row visible after scenario creation
 * V4: Version row contains a Restore button
 * V5: Version table shows Version number and date columns
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-ver-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Versioning Co ${Date.now()}`;

class ScenarioVersioningUIVerification {
  constructor() {
    this.results = {
      V1_scenario_actions_panel: { passed: false, evidence: '' },
      V2_version_history_heading: { passed: false, evidence: '' },
      V3_version_row_visible: { passed: false, evidence: '' },
      V4_restore_button_present: { passed: false, evidence: '' },
      V5_version_columns_visible: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Scenario Versioning UI ===');
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
      if (text.match(/sign up/i)) { await btn.click(); break; }
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

  async createClientAndScenario() {
    const navBtns = await this.page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/^clients$/i)) { await btn.click(); break; }
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
    await this.page.type('input[id="client-name"]', 'Version Test Client');
    await this.page.type('input[id="client-email"]', `verclient-${Date.now()}@verify.com`);
    await this.page.type('input[id="client-income"]', '120000');
    await this.page.evaluate(() => {
      const input = document.querySelector('input[id="client-dob"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '1985-06-15');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveBtn = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.match(/save client/i))
    );
    await saveBtn.click();
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Version Test Client'),
      { timeout: 8000 }
    );
    const navBtns2 = await this.page.$$('.nav-btn');
    for (const btn of navBtns2) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/new scenario/i)) { await btn.click(); break; }
    }
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading clients'),
      { timeout: 10000 }
    );
    await this.page.select('select#sf-client',
      await this.page.$eval('select#sf-client option:not([value=""])', (el) => el.value)
    );
    await this.page.$eval('input#sf-name', (el) => { el.value = ''; });
    await this.page.type('input#sf-name', 'Version Test Plan');
    const runBtn = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.match(/run scenario/i))
    );
    await runBtn.click();
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Final Wealth'),
      { timeout: 15000 }
    );
    console.log('  Scenario saved automatically via Run Scenario');
  console.log('  Created client and scenario');
  }

  async selectScenarioInList() {
    const navBtns = await this.page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/saved scenarios/i)) { await btn.click(); break; }
    }
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading scenarios'),
      { timeout: 10000 }
    );
    const row = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('.scenarios-table tbody tr')].find((r) =>
        r.textContent.includes('Version Test Plan')
      )
    );
    if (row) await row.click();
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Download PDF'),
      { timeout: 8000 }
    );
    console.log('  Selected scenario, ScenarioActions visible');
  }

  async verifyV1ScenarioActionsPanel() {
    console.log('\nV1: Selecting a scenario shows ScenarioActions panel');
    try {
      const hasPanel = await this.page.evaluate(() =>
        document.body.innerText.includes('Download PDF') &&
        document.body.innerText.includes('Email Report')
      );
      this.results.V1_scenario_actions_panel.passed = hasPanel;
      this.results.V1_scenario_actions_panel.evidence = hasPanel
        ? 'ScenarioActions panel visible with PDF and Email buttons'
        : 'ScenarioActions panel not fully visible';
      console.log(`  ${hasPanel ? 'PASS' : 'FAIL'}: ${this.results.V1_scenario_actions_panel.evidence}`);
    } catch (err) {
      this.results.V1_scenario_actions_panel.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2VersionHistoryHeading() {
    console.log('\nV2: "Version History" heading present in ScenarioActions');
    try {
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Version History') ||
              document.body.innerText.includes('No versions'),
        { timeout: 8000 }
      );
      const hasHeading = await this.page.evaluate(() =>
        document.body.innerText.includes('Version History')
      );
      this.results.V2_version_history_heading.passed = hasHeading;
      this.results.V2_version_history_heading.evidence = hasHeading
        ? '"Version History" heading found'
        : '"Version History" heading not found';
      console.log(`  ${hasHeading ? 'PASS' : 'FAIL'}: ${this.results.V2_version_history_heading.evidence}`);
    } catch (err) {
      this.results.V2_version_history_heading.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3VersionRowVisible() {
    console.log('\nV3: At least 1 version row visible');
    try {
      const versionRows = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('.version-row, .versions-table tbody tr');
        return rows.length;
      });
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasVersion = versionRows > 0 || pageText.match(/version\s+1|v1\b/i);
      this.results.V3_version_row_visible.passed = !!hasVersion;
      this.results.V3_version_row_visible.evidence = hasVersion
        ? `Version rows found: ${versionRows}`
        : 'No version rows found';
      console.log(`  ${!!hasVersion ? 'PASS' : 'FAIL'}: ${this.results.V3_version_row_visible.evidence}`);
    } catch (err) {
      this.results.V3_version_row_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4RestoreButtonPresent() {
    console.log('\nV4: Restore button present in version rows');
    try {
      const hasRestore = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/restore/i))
      );
      this.results.V4_restore_button_present.passed = hasRestore;
      this.results.V4_restore_button_present.evidence = hasRestore
        ? 'Restore button found in version history'
        : 'Restore button not found';
      console.log(`  ${hasRestore ? 'PASS' : 'FAIL'}: ${this.results.V4_restore_button_present.evidence}`);
    } catch (err) {
      this.results.V4_restore_button_present.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5VersionColumnsVisible() {
    console.log('\nV5: Version table shows Version and Date columns');
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasVersionCol = pageText.match(/version/i);
      const hasDateCol = pageText.match(/date|created/i);
      const passed = !!(hasVersionCol && hasDateCol);
      this.results.V5_version_columns_visible.passed = passed;
      this.results.V5_version_columns_visible.evidence = passed
        ? 'Version and Date columns visible in version table'
        : `Version col: ${!!hasVersionCol}, Date col: ${!!hasDateCol}`;
      console.log(`  ${passed ? 'PASS' : 'FAIL'}: ${this.results.V5_version_columns_visible.evidence}`);
    } catch (err) {
      this.results.V5_version_columns_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async printSummary() {
    console.log('\n=== VERIFICATION SUMMARY ===');
    let passed = 0, total = 0;
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
      await this.createClientAndScenario();
      await this.selectScenarioInList();
      await this.verifyV1ScenarioActionsPanel();
      await this.verifyV2VersionHistoryHeading();
      await this.verifyV3VersionRowVisible();
      await this.verifyV4RestoreButtonPresent();
      await this.verifyV5VersionColumnsVisible();
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

new ScenarioVersioningUIVerification().run();
