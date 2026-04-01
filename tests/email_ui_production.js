/**
 * Production Verification: Email UI
 *
 * Run: npm run verify:email_ui
 * Target: https://d1p3am5dl1sho7.cloudfront.net
 *
 * V1: ScenarioActions shows "Email Report" button
 * V2: Clicking "Email Report" shows email form
 * V3: Email form has recipient input field
 * V4: Email form has "Send Email" submit button
 * V5: Cancelling the form closes it
 */

const puppeteer = require('puppeteer');

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://d1p3am5bl1sho7.cloudfront.net';

const TEST_EMAIL = `verify-em-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = `Email UI Co ${Date.now()}`;

class EmailUIVerification {
  constructor() {
    this.results = {
      V1_email_report_button: { passed: false, evidence: '' },
      V2_email_form_visible: { passed: false, evidence: '' },
      V3_recipient_input: { passed: false, evidence: '' },
      V4_send_email_button: { passed: false, evidence: '' },
      V5_cancel_closes_form: { passed: false, evidence: '' },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('\n=== Production Verification: Email UI ===');
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
    await this.page.type('input[id="client-name"]', 'Email Test Client');
    await this.page.type('input[id="client-email"]', `emailclient-${Date.now()}@verify.com`);
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
      () => document.body.innerText.includes('Email Test Client'),
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
    await this.page.type('input#sf-name', 'Email Test Plan');
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
        r.textContent.includes('Email Test Plan')
      )
    );
    if (row) await row.click();
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Download PDF'),
      { timeout: 8000 }
    );
    console.log('  Selected scenario, ScenarioActions visible');
  }

  async verifyV1EmailReportButton() {
    console.log('\nV1: "Email Report" button present in ScenarioActions');
    try {
      const hasBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/email report/i))
      );
      this.results.V1_email_report_button.passed = hasBtn;
      this.results.V1_email_report_button.evidence = hasBtn
        ? '"Email Report" button found in ScenarioActions'
        : '"Email Report" button not found';
      console.log(`  ${hasBtn ? 'PASS' : 'FAIL'}: ${this.results.V1_email_report_button.evidence}`);
    } catch (err) {
      this.results.V1_email_report_button.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV2EmailFormVisible() {
    console.log('\nV2: Clicking "Email Report" shows email form');
    try {
      const emailBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/email report/i))
      );
      await emailBtn.click();
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Email Scenario Report') ||
              document.body.innerText.includes('Recipient Email'),
        { timeout: 5000 }
      );
      const hasForm = await this.page.evaluate(() =>
        document.body.innerText.includes('Email Scenario Report') ||
        document.body.innerText.includes('Recipient Email')
      );
      this.results.V2_email_form_visible.passed = hasForm;
      this.results.V2_email_form_visible.evidence = hasForm
        ? 'Email form appeared after button click'
        : 'Email form did not appear';
      console.log(`  ${hasForm ? 'PASS' : 'FAIL'}: ${this.results.V2_email_form_visible.evidence}`);
    } catch (err) {
      this.results.V2_email_form_visible.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV3RecipientInput() {
    console.log('\nV3: Email form has recipient input');
    try {
      const input = await this.page.$('#recipient-email');
      const hasInput = input !== null;
      this.results.V3_recipient_input.passed = hasInput;
      this.results.V3_recipient_input.evidence = hasInput
        ? 'Recipient email input #recipient-email found'
        : 'Recipient email input not found';
      console.log(`  ${hasInput ? 'PASS' : 'FAIL'}: ${this.results.V3_recipient_input.evidence}`);
    } catch (err) {
      this.results.V3_recipient_input.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV4SendEmailButton() {
    console.log('\nV4: Email form has "Send Email" submit button');
    try {
      const hasBtn = await this.page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.textContent.match(/send email/i))
      );
      this.results.V4_send_email_button.passed = hasBtn;
      this.results.V4_send_email_button.evidence = hasBtn
        ? '"Send Email" button found in form'
        : '"Send Email" button not found';
      console.log(`  ${hasBtn ? 'PASS' : 'FAIL'}: ${this.results.V4_send_email_button.evidence}`);
    } catch (err) {
      this.results.V4_send_email_button.evidence = `Error: ${err.message}`;
      console.log(`  FAIL: ${err.message}`);
    }
  }

  async verifyV5CancelClosesForm() {
    console.log('\nV5: Clicking Cancel closes the email form');
    try {
      const cancelBtn = await this.page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.match(/^cancel$/i))
      );
      await cancelBtn.click();
      await this.page.waitForFunction(
        () => !document.body.innerText.includes('Recipient Email'),
        { timeout: 5000 }
      );
      const formGone = await this.page.evaluate(() =>
        !document.body.innerText.includes('Recipient Email')
      );
      this.results.V5_cancel_closes_form.passed = formGone;
      this.results.V5_cancel_closes_form.evidence = formGone
        ? 'Email form closed after Cancel click'
        : 'Email form still visible after Cancel click';
      console.log(`  ${formGone ? 'PASS' : 'FAIL'}: ${this.results.V5_cancel_closes_form.evidence}`);
    } catch (err) {
      this.results.V5_cancel_closes_form.evidence = `Error: ${err.message}`;
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
      await this.verifyV1EmailReportButton();
      await this.verifyV2EmailFormVisible();
      await this.verifyV3RecipientInput();
      await this.verifyV4SendEmailButton();
      await this.verifyV5CancelClosesForm();
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

new EmailUIVerification().run();
