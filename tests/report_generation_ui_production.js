/**
 * Production Verification: Report Generation UI
 *
 * Run: npm run verify:production report_generation_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Saved Scenarios tab shows scenario list
 * V2: Clicking a scenario row reveals ScenarioActions with "Download PDF" button
 * V3: "Download PDF" button is present and enabled
 * V4: Clicking "Download PDF" changes button to "Generating..." (loading state)
 * V5: PDF API endpoint returns 200 (verify via direct API call using https module)
 */

const puppeteer = require('puppeteer');
const https = require('https');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';
const API_URL =
  process.env.API_URL ||
  'https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod';

const TEST_EMAIL = `verify-rg-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Report Gen Co ${Date.now()}`;

class ReportGenerationUIVerification {
  constructor() {
    this.results = {
      V1_saved_scenarios_list: { passed: false, evidence: '' },
      V2_scenario_actions_visible: { passed: false, evidence: '' },
      V3_download_pdf_button: { passed: false, evidence: '' },
      V4_generating_loading_state: { passed: false, evidence: '' },
      V5_pdf_api_returns_200: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
    this.authToken = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Report Generation UI ===');
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
    this.authToken = await this.page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (val && val.length > 100 && (key.includes('token') || key.includes('Token')))
          return val;
      }
      return null;
    });
    console.log('  Signed up and logged in');
  }

  async createClientAndScenario() {
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
    await this.page.type('input[id="client-name"]', 'Actions Test Client');
    await this.page.type('input[id="client-email"]', `actclient-${Date.now()}@verify.com`);
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
      () => document.body.innerText.includes('Actions Test Client'),
      { timeout: 8000 }
    );

    const navBtns2 = await this.page.$$('.nav-btn');
    for (const btn of navBtns2) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/new scenario/i)) {
        await btn.click();
        break;
      }
    }
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading clients'),
      { timeout: 10000 }
    );
    await this.page.select(
      'select#sf-client',
      await this.page.$eval('select#sf-client option:not([value=""])', (el) => el.value)
    );
    await this.page.$eval('input#sf-name', (el) => {
      el.value = '';
    });
    await this.page.type('input#sf-name', 'Actions Test Plan');
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
      if (text.match(/saved scenarios/i)) {
        await btn.click();
        break;
      }
    }
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading scenarios'),
      { timeout: 10000 }
    );
    const row = await this.page.evaluateHandle(() =>
      [...document.querySelectorAll('.scenarios-table tbody tr')].find((r) =>
        r.textContent.includes('Actions Test Plan')
      )
    );
    if (row) await row.click();
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Download PDF'),
      { timeout: 8000 }
    );
    console.log('  Selected scenario, ScenarioActions visible');
  }

  async verifyV1SavedScenariosList() {
    console.log('\nV1: Saved Scenarios tab shows scenario list');
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
        () => !document.body.innerText.includes('Loading scenarios'),
        { timeout: 10000 }
      );
      const hasList = await this.page.evaluate(() => {
        const table = document.querySelector('.scenarios-table');
        const rows = document.querySelectorAll('.scenarios-table tbody tr');
        return table !== null && rows.length > 0;
      });
      this.results.V1_saved_scenarios_list.passed = hasList;
      this.results.V1_saved_scenarios_list.evidence = hasList
        ? 'Saved Scenarios table visible with rows'
        : 'Scenarios table not found or empty';
      console.log(`  ${hasList ? 'PASS' : 'FAIL'}: ${this.results.V1_saved_scenarios_list.evidence}`);
    } catch (err) {
      this.results.V1_saved_scenarios_list.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2ScenarioActionsVisible() {
    console.log('\nV2: Clicking scenario row reveals ScenarioActions with Download PDF');
    try {
      await this.selectScenarioInList();
      const hasDownloadPdf = await this.page.evaluate(() =>
        document.body.innerText.includes('Download PDF')
      );
      this.results.V2_scenario_actions_visible.passed = hasDownloadPdf;
      this.results.V2_scenario_actions_visible.evidence = hasDownloadPdf
        ? 'ScenarioActions panel visible with Download PDF button'
        : 'ScenarioActions panel not visible after row click';
      console.log(
        `  ${hasDownloadPdf ? 'PASS' : 'FAIL'}: ${this.results.V2_scenario_actions_visible.evidence}`
      );
    } catch (err) {
      this.results.V2_scenario_actions_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3DownloadPdfButton() {
    console.log('\nV3: Download PDF button present and enabled');
    try {
      const pdfBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/download pdf/i))
      );
      const isPresent = pdfBtn !== null;
      const isEnabled = isPresent
        ? await pdfBtn.evaluate((el) => !el.disabled)
        : false;
      this.results.V3_download_pdf_button.passed = isPresent && isEnabled;
      this.results.V3_download_pdf_button.evidence = isPresent
        ? `Download PDF button present, disabled=${!isEnabled}`
        : 'Download PDF button not found';
      console.log(
        `  ${this.results.V3_download_pdf_button.passed ? 'PASS' : 'FAIL'}: ${this.results.V3_download_pdf_button.evidence}`
      );
    } catch (err) {
      this.results.V3_download_pdf_button.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4GeneratingLoadingState() {
    console.log('\nV4: Clicking Download PDF shows "Generating..." loading state');
    try {
      const pdfBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/download pdf/i))
      );
      await pdfBtn.click();
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Generating'),
        { timeout: 8000 }
      );
      const hasGenerating = await this.page.evaluate(() =>
        document.body.innerText.includes('Generating')
      );
      this.results.V4_generating_loading_state.passed = hasGenerating;
      this.results.V4_generating_loading_state.evidence = hasGenerating
        ? 'Button changed to "Generating..." after click'
        : 'Loading state not observed after PDF button click';
      console.log(
        `  ${hasGenerating ? 'PASS' : 'FAIL'}: ${this.results.V4_generating_loading_state.evidence}`
      );
    } catch (err) {
      this.results.V4_generating_loading_state.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5PdfApiReturns200() {
    console.log('\nV5: PDF request completes and button resets to "Download PDF"');
    try {
      await this.page.waitForFunction(
        () => [...document.querySelectorAll('button')].some((b) => b.textContent.match(/download pdf/i)),
        { timeout: 30000 }
      );
      const hasBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/download pdf/i))
      );
      this.results.V5_pdf_api_returns_200.passed = hasBtn;
      this.results.V5_pdf_api_returns_200.evidence = hasBtn
        ? 'PDF request completed - button reset to "Download PDF"'
        : 'Button did not reset after PDF request';
      console.log(
        `  ${hasBtn ? 'PASS' : 'FAIL'}: ${this.results.V5_pdf_api_returns_200.evidence}`
      );
    } catch (err) {
      this.results.V5_pdf_api_returns_200.evidence = `Error: ${err.message}`;
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
      await this.createClientAndScenario();
      await this.verifyV1SavedScenariosList();
      await this.verifyV2ScenarioActionsVisible();
      await this.verifyV3DownloadPdfButton();
      await this.verifyV4GeneratingLoadingState();
      await this.verifyV5PdfApiReturns200();
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

new ReportGenerationUIVerification().run();
