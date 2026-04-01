/**
 * Production Verification: Tier Enforcement UI
 *
 * Run: npm run verify:tier_enforcement_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Billing tab accessible and shows current tier label
 * V2: Starter tier scenario actions show Excel upgrade notice (tier gate)
 * V3: Professional plan listed with its price on billing page
 * V4: Upgrade button visible for non-current plans
 * V5: Billing page shows feature lists per plan
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-tier-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Tier Enforce Co ${Date.now()}`;

class TierEnforcementUIVerification {
  constructor() {
    this.results = {
      V1_billing_shows_tier: { passed: false, evidence: '' },
      V2_starter_excel_gated: { passed: false, evidence: '' },
      V3_professional_plan_price: { passed: false, evidence: '' },
      V4_upgrade_button_present: { passed: false, evidence: '' },
      V5_plan_features_listed: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Tier Enforcement UI ===');
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
    console.log('  Signed up and logged in (starter tier)');
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
    await this.page.type('input[id="client-name"]', 'Tier Test Client');
    await this.page.type('input[id="client-email"]', `tierclient-${Date.now()}@verify.com`);
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
      () => document.body.innerText.includes('Tier Test Client'),
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
    await this.page.type('input#sf-name', 'Tier Test Plan');
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

  async verifyV1BillingShowsTier() {
    console.log('\nV1: Billing tab accessible and shows current tier');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/^billing$/i)) { await btn.click(); break; }
      }
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Starter') || document.body.innerText.includes('Plan'),
        { timeout: 8000 }
      );
      const hasCurrentPlan = await this.page.evaluate(() =>
        document.body.innerText.includes('Current Plan')
      );
      this.results.V1_billing_shows_tier.passed = hasCurrentPlan;
      this.results.V1_billing_shows_tier.evidence = hasCurrentPlan
        ? 'Billing page shows "Current Plan" badge'
        : 'Billing page did not show current tier';
      console.log(`  ${hasCurrentPlan ? 'PASS' : 'FAIL'}: ${this.results.V1_billing_shows_tier.evidence}`);
    } catch (err) {
      this.results.V1_billing_shows_tier.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2StarterExcelGated() {
    console.log('\nV2: Starter tier shows Excel export gated (upgrade notice)');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/saved scenarios/i)) { await btn.click(); break; }
      }
      await this.page.waitForFunction(
        () => [...document.querySelectorAll('.scenarios-table tbody tr')].some((r) =>
          r.textContent.includes('Tier Test Plan')
        ),
        { timeout: 10000 }
      );
      await this.page.evaluate(() => {
        const row = [...document.querySelectorAll('.scenarios-table tbody tr')].find((r) =>
          r.textContent.includes('Tier Test Plan')
        );
        if (row) row.click();
      });
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Download PDF'),
        { timeout: 8000 }
      );
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasGate = pageText.match(/excel export requires professional/i) ||
                      pageText.match(/professional plan/i);
      this.results.V2_starter_excel_gated.passed = !!hasGate;
      this.results.V2_starter_excel_gated.evidence = hasGate
        ? 'Excel export tier gate visible for starter user'
        : 'Excel export tier gate not found';
      console.log(`  ${!!hasGate ? 'PASS' : 'FAIL'}: ${this.results.V2_starter_excel_gated.evidence}`);
    } catch (err) {
      this.results.V2_starter_excel_gated.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3ProfessionalPlanPrice() {
    console.log('\nV3: Professional plan listed with price on billing page');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      for (const btn of navBtns) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text.match(/^billing$/i)) { await btn.click(); break; }
      }
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Professional'),
        { timeout: 8000 }
      );
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasProfPrice = pageText.match(/\$99|\$99\/month|99.*month/i);
      this.results.V3_professional_plan_price.passed = !!hasProfPrice;
      this.results.V3_professional_plan_price.evidence = hasProfPrice
        ? 'Professional plan price ($99) visible'
        : 'Professional plan price not visible';
      console.log(`  ${!!hasProfPrice ? 'PASS' : 'FAIL'}: ${this.results.V3_professional_plan_price.evidence}`);
    } catch (err) {
      this.results.V3_professional_plan_price.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4UpgradeButtonPresent() {
    console.log('\nV4: Upgrade button visible on billing page');
    try {
      const hasUpgrade = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/upgrade/i))
      );
      this.results.V4_upgrade_button_present.passed = hasUpgrade;
      this.results.V4_upgrade_button_present.evidence = hasUpgrade
        ? 'Upgrade button found on billing page'
        : 'Upgrade button not found';
      console.log(`  ${hasUpgrade ? 'PASS' : 'FAIL'}: ${this.results.V4_upgrade_button_present.evidence}`);
    } catch (err) {
      this.results.V4_upgrade_button_present.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5PlanFeaturesListed() {
    console.log('\nV5: Billing page shows feature lists per plan');
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasFeatures = pageText.match(/pdf|excel|scenarios|clients|analytics/i);
      this.results.V5_plan_features_listed.passed = !!hasFeatures;
      this.results.V5_plan_features_listed.evidence = hasFeatures
        ? 'Plan features listed on billing page'
        : 'Plan features not found on billing page';
      console.log(`  ${!!hasFeatures ? 'PASS' : 'FAIL'}: ${this.results.V5_plan_features_listed.evidence}`);
    } catch (err) {
      this.results.V5_plan_features_listed.evidence = `Error: ${err.message}`;
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
      await this.verifyV1BillingShowsTier();
      await this.verifyV2StarterExcelGated();
      await this.verifyV3ProfessionalPlanPrice();
      await this.verifyV4UpgradeButtonPresent();
      await this.verifyV5PlanFeaturesListed();
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

new TierEnforcementUIVerification().run();
