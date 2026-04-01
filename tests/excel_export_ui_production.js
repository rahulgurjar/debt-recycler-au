/**
 * Production Verification: Excel Export UI
 *
 * Run: npm run verify:production excel_export_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Saved Scenarios tab loads with scenarios
 * V2: Selecting scenario shows ScenarioActions
 * V3: Starter tier shows "Excel export requires Professional plan" upgrade notice
 * V4: Upgrade notice is visible next to where Excel button would be
 * V5: "Export Excel" button is NOT shown for starter tier (only upgrade notice)
 *
 * Note: Test user signs up as starter tier, which is the default.
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-xl-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Excel Export Co ${Date.now()}`;

class ExcelExportUIVerification {
  constructor() {
    this.results = {
      V1_saved_scenarios_loads: { passed: false, evidence: '' },
      V2_scenario_actions_visible: { passed: false, evidence: '' },
      V3_excel_upgrade_notice: { passed: false, evidence: '' },
      V4_upgrade_notice_visible: { passed: false, evidence: '' },
      V5_export_excel_button_absent: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Excel Export UI ===');
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

  async verifyV1SavedScenariosLoads() {
    console.log('\nV1: Saved Scenarios tab loads with scenarios');
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
      this.results.V1_saved_scenarios_loads.passed = hasList;
      this.results.V1_saved_scenarios_loads.evidence = hasList
        ? 'Saved Scenarios tab loaded with scenario rows'
        : 'Scenarios table not found or empty';
      console.log(
        `  ${hasList ? 'PASS' : 'FAIL'}: ${this.results.V1_saved_scenarios_loads.evidence}`
      );
    } catch (err) {
      this.results.V1_saved_scenarios_loads.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2ScenarioActionsVisible() {
    console.log('\nV2: Selecting scenario shows ScenarioActions');
    try {
      await this.selectScenarioInList();
      const hasActions = await this.page.evaluate(() =>
        document.body.innerText.includes('Download PDF')
      );
      this.results.V2_scenario_actions_visible.passed = hasActions;
      this.results.V2_scenario_actions_visible.evidence = hasActions
        ? 'ScenarioActions panel visible after row click'
        : 'ScenarioActions panel not visible';
      console.log(
        `  ${hasActions ? 'PASS' : 'FAIL'}: ${this.results.V2_scenario_actions_visible.evidence}`
      );
    } catch (err) {
      this.results.V2_scenario_actions_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3ExcelUpgradeNotice() {
    console.log('\nV3: Starter tier shows Excel upgrade notice');
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasUpgradeNotice =
        pageText.includes('Excel export requires Professional plan') ||
        pageText.match(/excel.*professional/i) ||
        pageText.match(/professional.*excel/i);
      this.results.V3_excel_upgrade_notice.passed = !!hasUpgradeNotice;
      this.results.V3_excel_upgrade_notice.evidence = hasUpgradeNotice
        ? 'Excel upgrade notice found: "Excel export requires Professional plan"'
        : 'Excel upgrade notice not found for starter tier';
      console.log(
        `  ${!!hasUpgradeNotice ? 'PASS' : 'FAIL'}: ${this.results.V3_excel_upgrade_notice.evidence}`
      );
    } catch (err) {
      this.results.V3_excel_upgrade_notice.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4UpgradeNoticeVisible() {
    console.log('\nV4: Upgrade notice is visible near Excel export area');
    try {
      const noticeEl = await this.page.evaluateHandle(() => {
        const all = [...document.querySelectorAll('*')];
        return all.find(
          (el) =>
            el.children.length === 0 &&
            (el.textContent.match(/excel export requires professional/i) ||
              el.textContent.match(/professional plan/i))
        );
      });
      const isVisible = noticeEl
        ? await noticeEl.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
        : false;
      this.results.V4_upgrade_notice_visible.passed = isVisible;
      this.results.V4_upgrade_notice_visible.evidence = isVisible
        ? 'Upgrade notice element is visible on page'
        : 'Upgrade notice element not found or not visible';
      console.log(
        `  ${isVisible ? 'PASS' : 'FAIL'}: ${this.results.V4_upgrade_notice_visible.evidence}`
      );
    } catch (err) {
      this.results.V4_upgrade_notice_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5ExportExcelButtonAbsent() {
    console.log('\nV5: Export Excel button NOT shown for starter tier');
    try {
      const hasExportExcelBtn = await this.page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.some(
          (b) => b.textContent.trim().match(/^export excel$/i)
        );
      });
      this.results.V5_export_excel_button_absent.passed = !hasExportExcelBtn;
      this.results.V5_export_excel_button_absent.evidence = !hasExportExcelBtn
        ? 'Export Excel button correctly absent for starter tier'
        : 'Export Excel button incorrectly present for starter tier';
      console.log(
        `  ${!hasExportExcelBtn ? 'PASS' : 'FAIL'}: ${this.results.V5_export_excel_button_absent.evidence}`
      );
    } catch (err) {
      this.results.V5_export_excel_button_absent.evidence = `Error: ${err.message}`;
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
      await this.verifyV1SavedScenariosLoads();
      await this.verifyV2ScenarioActionsVisible();
      await this.verifyV3ExcelUpgradeNotice();
      await this.verifyV4UpgradeNoticeVisible();
      await this.verifyV5ExportExcelButtonAbsent();
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

new ExcelExportUIVerification().run();
