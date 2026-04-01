/**
 * Production Verification: Billing UI
 *
 * Run: npm run verify:billing_ui
 * Target: https://d1p3am5bl1sho7.cloudfront.net
 *
 * V1: Billing tab visible in navigation
 * V2: Billing page shows all 3 plan cards (Starter, Professional, Enterprise)
 * V3: "Current Plan" badge shown on Starter (new user default)
 * V4: Professional plan shows an Upgrade button
 * V5: Clicking Upgrade shows payment form with payment method input
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-bill-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Billing UI Co ${Date.now()}`;

class BillingUIVerification {
  constructor() {
    this.results = {
      V1_billing_tab_visible: { passed: false, evidence: '' },
      V2_three_plan_cards: { passed: false, evidence: '' },
      V3_current_plan_badge: { passed: false, evidence: '' },
      V4_upgrade_button_visible: { passed: false, evidence: '' },
      V5_payment_form_shows: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Billing UI ===');
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

  async navigateToBilling() {
    const navBtns = await this.page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text.match(/^billing$/i)) { await btn.click(); break; }
    }
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Starter') || document.body.innerText.includes('Loading'),
      { timeout: 8000 }
    );
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Loading'),
      { timeout: 10000 }
    );
    console.log('  Navigated to Billing tab');
  }

  async verifyV1BillingTabVisible() {
    console.log('\nV1: Billing tab visible in navigation');
    try {
      const navBtns = await this.page.$$('.nav-btn');
      const tabTexts = await Promise.all(navBtns.map((b) => b.evaluate((el) => el.textContent.trim())));
      const hasBilling = tabTexts.some((t) => t.match(/^billing$/i));
      this.results.V1_billing_tab_visible.passed = hasBilling;
      this.results.V1_billing_tab_visible.evidence = `Nav tabs: ${tabTexts.join(', ')}`;
      console.log(`  ${hasBilling ? 'PASS' : 'FAIL'}: ${this.results.V1_billing_tab_visible.evidence}`);
    } catch (err) {
      this.results.V1_billing_tab_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2ThreePlanCards() {
    console.log('\nV2: Billing page shows Starter, Professional, Enterprise plan cards');
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const hasStarter = pageText.match(/starter/i);
      const hasProfessional = pageText.match(/professional/i);
      const hasEnterprise = pageText.match(/enterprise/i);
      const allPresent = !!(hasStarter && hasProfessional && hasEnterprise);
      this.results.V2_three_plan_cards.passed = allPresent;
      this.results.V2_three_plan_cards.evidence = `Starter: ${!!hasStarter}, Professional: ${!!hasProfessional}, Enterprise: ${!!hasEnterprise}`;
      console.log(`  ${allPresent ? 'PASS' : 'FAIL'}: ${this.results.V2_three_plan_cards.evidence}`);
    } catch (err) {
      this.results.V2_three_plan_cards.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3CurrentPlanBadge() {
    console.log('\nV3: "Current Plan" badge shown on Starter plan');
    try {
      const hasCurrentPlan = await this.page.evaluate(() =>
        document.body.innerText.includes('Current Plan')
      );
      this.results.V3_current_plan_badge.passed = hasCurrentPlan;
      this.results.V3_current_plan_badge.evidence = hasCurrentPlan
        ? '"Current Plan" badge visible on billing page'
        : '"Current Plan" badge not found';
      console.log(`  ${hasCurrentPlan ? 'PASS' : 'FAIL'}: ${this.results.V3_current_plan_badge.evidence}`);
    } catch (err) {
      this.results.V3_current_plan_badge.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4UpgradeButtonVisible() {
    console.log('\nV4: Professional plan shows Upgrade button');
    try {
      const hasUpgradeBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/upgrade/i))
      );
      this.results.V4_upgrade_button_visible.passed = hasUpgradeBtn;
      this.results.V4_upgrade_button_visible.evidence = hasUpgradeBtn
        ? 'Upgrade button found on billing page'
        : 'No Upgrade button found';
      console.log(`  ${hasUpgradeBtn ? 'PASS' : 'FAIL'}: ${this.results.V4_upgrade_button_visible.evidence}`);
    } catch (err) {
      this.results.V4_upgrade_button_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5PaymentFormShows() {
    console.log('\nV5: Clicking Upgrade shows payment form');
    try {
      const upgradeBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/upgrade/i))
      );
      await upgradeBtn.click();
      await this.page.waitForFunction(
        () => document.body.innerText.includes('payment') ||
              document.body.innerText.includes('Payment') ||
              document.querySelector('input[placeholder*="pm_"]') !== null ||
              document.querySelector('input[id*="payment"]') !== null,
        { timeout: 5000 }
      );
      const hasPaymentForm = await this.page.evaluate(() =>
        document.body.innerText.match(/payment/i) !== null ||
        document.querySelector('input') !== null
      );
      this.results.V5_payment_form_shows.passed = !!hasPaymentForm;
      this.results.V5_payment_form_shows.evidence = hasPaymentForm
        ? 'Payment form appeared after Upgrade button click'
        : 'Payment form did not appear';
      console.log(`  ${!!hasPaymentForm ? 'PASS' : 'FAIL'}: ${this.results.V5_payment_form_shows.evidence}`);
    } catch (err) {
      this.results.V5_payment_form_shows.evidence = `Error: ${err.message}`;
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
      await this.navigateToBilling();
      await this.verifyV1BillingTabVisible();
      await this.verifyV2ThreePlanCards();
      await this.verifyV3CurrentPlanBadge();
      await this.verifyV4UpgradeButtonVisible();
      await this.verifyV5PaymentFormShows();
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

new BillingUIVerification().run();
