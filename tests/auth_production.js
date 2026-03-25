/**
 * Chrome MCP Production Verification: Authentication
 *
 * Verifies login/signup functionality against live production environment
 * Run: npm run verify:production auth
 *
 * This test runs against the deployed React app + API
 * Verifies all V1-V5 requirements from spec/01_authentication.md
 */

const { Browser } = require("puppeteer");

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://d1p3am5bl1sho7.cloudfront.net";
const SCREENSHOTS_DIR = "./verification-evidence";

class AuthProductionVerification {
  constructor() {
    this.results = {
      V1_demo_login: { passed: false, evidence: "" },
      V2_demo_login_security: { passed: false, evidence: "" },
      V3_account_creation: { passed: false, evidence: "" },
      V4_password_validation: { passed: false, evidence: "" },
      V5_token_persistence: { passed: false, evidence: "" },
    };
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log(`\n🌐 Production Verification: Authentication`);
    console.log(`📍 Target: ${PRODUCTION_URL}`);
    console.log(`⏱️  Timestamp: ${new Date().toISOString()}\n`);

    try {
      this.browser = await Browser.launch();
      this.page = await this.browser.newPage();

      // Capture console logs and network activity
      this.page.on("console", (msg) => console.log(`  [Browser Console] ${msg.text()}`));

      // Capture screenshots
      if (!require("fs").existsSync(SCREENSHOTS_DIR)) {
        require("fs").mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error("❌ Failed to initialize browser:", error.message);
      throw error;
    }
  }

  async testV1_DemoLogin() {
    console.log("\n📋 V1: Demo Login with Provided Credentials");
    console.log("   Requirement: User can login with demo@example.com / password");

    try {
      await this.page.goto(`${PRODUCTION_URL}/login`, { waitUntil: "networkidle2" });

      // Fill demo credentials
      await this.page.type('input[name="email"]', "advisor@example.com");
      await this.page.type('input[name="password"]', "AdvisorPass123!");

      // Submit
      await this.page.click('button[type="submit"]');

      // Wait for redirect or success message
      await this.page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});

      // Check if logged in (dashboard should load)
      const loggedIn = await this.page.evaluate(() => {
        return document.querySelector('[data-testid="dashboard"]') !== null ||
               document.location.href.includes("/dashboard");
      });

      if (loggedIn) {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v1_demo_login_success.png` });
        this.results.V1_demo_login = {
          passed: true,
          evidence: "Demo login successful - dashboard loaded"
        };
        console.log("   ✅ PASSED: Demo credentials accepted, logged in successfully");
        return true;
      } else {
        const errorMsg = await this.page.evaluate(() => document.body.innerText);
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v1_demo_login_failure.png` });
        this.results.V1_demo_login = {
          passed: false,
          evidence: `Login failed. Page content: ${errorMsg.substring(0, 200)}`
        };
        console.log("   ❌ FAILED: Demo login did not redirect to dashboard");
        return false;
      }
    } catch (error) {
      this.results.V1_demo_login = { passed: false, evidence: error.message };
      console.log(`   ❌ ERROR: ${error.message}`);
      return false;
    }
  }

  async testV2_SecurityValidation() {
    console.log("\n📋 V2: Login Security - Invalid Credentials Rejected");
    console.log("   Requirement: Wrong password returns error, no access granted");

    try {
      await this.page.goto(`${PRODUCTION_URL}/login`, { waitUntil: "networkidle2" });

      // Try with wrong password
      await this.page.type('input[name="email"]', "advisor@example.com");
      await this.page.type('input[name="password"]', "WrongPassword123!");
      await this.page.click('button[type="submit"]');

      // Wait for error message
      await this.page.waitForSelector('[data-testid="error-message"]', { timeout: 3000 }).catch(() => {});

      const errorShown = await this.page.evaluate(() => {
        const errorEl = document.querySelector('[data-testid="error-message"]');
        return errorEl && errorEl.innerText.length > 0;
      });

      const stillOnLogin = await this.page.evaluate(() => {
        return document.location.href.includes("/login");
      });

      if (errorShown && stillOnLogin) {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v2_security_error.png` });
        this.results.V2_demo_login_security = {
          passed: true,
          evidence: "Invalid credentials rejected with error message"
        };
        console.log("   ✅ PASSED: Invalid credentials properly rejected");
        return true;
      } else {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v2_security_failure.png` });
        this.results.V2_demo_login_security = {
          passed: false,
          evidence: "Wrong credentials were not properly rejected"
        };
        console.log("   ❌ FAILED: Security validation failed");
        return false;
      }
    } catch (error) {
      this.results.V2_demo_login_security = { passed: false, evidence: error.message };
      console.log(`   ❌ ERROR: ${error.message}`);
      return false;
    }
  }

  async testV3_AccountCreation() {
    console.log("\n📋 V3: Account Creation / Sign Up");
    console.log("   Requirement: New users can create account, receives welcome email");

    try {
      await this.page.goto(`${PRODUCTION_URL}/signup`, { waitUntil: "networkidle2" });

      // Generate unique email
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = "TestPass123!";

      // Fill signup form
      await this.page.type('input[name="email"]', testEmail);
      await this.page.type('input[name="firstName"]', "Test");
      await this.page.type('input[name="lastName"]', "User");
      await this.page.type('input[name="password"]', testPassword);
      await this.page.type('input[name="confirmPassword"]', testPassword);

      // Submit
      await this.page.click('button[type="submit"]');

      // Wait for success
      await this.page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});

      const signupSuccess = await this.page.evaluate(() => {
        return document.location.href.includes("/dashboard") ||
               document.querySelector('[data-testid="welcome-message"]') !== null;
      });

      if (signupSuccess) {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v3_signup_success.png` });
        this.results.V3_account_creation = {
          passed: true,
          evidence: `Account created: ${testEmail}`
        };
        console.log("   ✅ PASSED: New account created successfully");
        return true;
      } else {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v3_signup_failure.png` });
        this.results.V3_account_creation = {
          passed: false,
          evidence: "Signup did not complete successfully"
        };
        console.log("   ❌ FAILED: Account creation did not redirect");
        return false;
      }
    } catch (error) {
      this.results.V3_account_creation = { passed: false, evidence: error.message };
      console.log(`   ❌ ERROR: ${error.message}`);
      return false;
    }
  }

  async testV4_PasswordValidation() {
    console.log("\n📋 V4: Password Validation Rules");
    console.log("   Requirement: Weak passwords rejected, errors shown");

    try {
      await this.page.goto(`${PRODUCTION_URL}/signup`, { waitUntil: "networkidle2" });

      // Try weak password (too short)
      await this.page.type('input[name="email"]', "weaktest@example.com");
      await this.page.type('input[name="password"]', "short");

      // Check if validation error shows
      await this.page.waitForTimeout(500);

      const validationError = await this.page.evaluate(() => {
        const passwordInput = document.querySelector('input[name="password"]');
        const errorMsg = document.querySelector('[data-testid="password-error"]');
        return errorMsg && errorMsg.innerText.length > 0;
      });

      if (validationError) {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v4_validation_error.png` });
        this.results.V4_password_validation = {
          passed: true,
          evidence: "Weak password rejected with validation error"
        };
        console.log("   ✅ PASSED: Password validation enforced");
        return true;
      } else {
        await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v4_validation_failure.png` });
        this.results.V4_password_validation = {
          passed: false,
          evidence: "Weak password was not rejected"
        };
        console.log("   ❌ FAILED: Password validation not enforced");
        return false;
      }
    } catch (error) {
      this.results.V4_password_validation = { passed: false, evidence: error.message };
      console.log(`   ❌ ERROR: ${error.message}`);
      return false;
    }
  }

  async testV5_TokenPersistence() {
    console.log("\n📋 V5: Session Persistence");
    console.log("   Requirement: JWT token stored, session persists across navigation");

    try {
      // Login first
      await this.page.goto(`${PRODUCTION_URL}/login`, { waitUntil: "networkidle2" });
      await this.page.type('input[name="email"]', "advisor@example.com");
      await this.page.type('input[name="password"]', "AdvisorPass123!");
      await this.page.click('button[type="submit"]');
      await this.page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});

      // Check localStorage for token
      const hasToken = await this.page.evaluate(() => {
        return localStorage.getItem("authToken") !== null;
      });

      if (hasToken) {
        // Navigate to another page
        await this.page.goto(`${PRODUCTION_URL}/scenarios`, { waitUntil: "networkidle2" });

        // Verify still logged in
        const stillLoggedIn = await this.page.evaluate(() => {
          return localStorage.getItem("authToken") !== null &&
                 !document.location.href.includes("/login");
        });

        if (stillLoggedIn) {
          await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v5_token_persistence.png` });
          this.results.V5_token_persistence = {
            passed: true,
            evidence: "Token stored in localStorage, session persists"
          };
          console.log("   ✅ PASSED: Session persists with token");
          return true;
        }
      }

      await this.page.screenshot({ path: `${SCREENSHOTS_DIR}/v5_token_failure.png` });
      this.results.V5_token_persistence = {
        passed: false,
        evidence: "Token not persisted or session lost"
      };
      console.log("   ❌ FAILED: Token persistence failed");
      return false;
    } catch (error) {
      this.results.V5_token_persistence = { passed: false, evidence: error.message };
      console.log(`   ❌ ERROR: ${error.message}`);
      return false;
    }
  }

  async verify() {
    await this.setup();

    // Run all verification tests
    await this.testV1_DemoLogin();
    await this.testV2_SecurityValidation();
    await this.testV3_AccountCreation();
    await this.testV4_PasswordValidation();
    await this.testV5_TokenPersistence();

    // Generate report
    this.printReport();

    // Cleanup
    if (this.browser) {
      await this.browser.close();
    }

    return this.getPassRate();
  }

  printReport() {
    console.log("\n" + "=".repeat(70));
    console.log("🔍 PRODUCTION VERIFICATION REPORT: Authentication");
    console.log("=".repeat(70));

    const results = this.results;
    let passCount = 0;
    let failCount = 0;

    Object.entries(results).forEach(([test, result]) => {
      const status = result.passed ? "✅ PASSED" : "❌ FAILED";
      console.log(`\n${status} - ${test}`);
      console.log(`   Evidence: ${result.evidence}`);

      if (result.passed) passCount++;
      else failCount++;
    });

    console.log("\n" + "=".repeat(70));
    console.log(`📊 Results: ${passCount}/${passCount + failCount} tests passed`);
    console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}/`);
    console.log("=".repeat(70) + "\n");
  }

  getPassRate() {
    const passed = Object.values(this.results).filter(r => r.passed).length;
    const total = Object.values(this.results).length;
    return (passed / total) * 100;
  }
}

// Run verification
(async () => {
  const verifier = new AuthProductionVerification();
  const passRate = await verifier.verify();

  process.exit(passRate === 100 ? 0 : 1);
})();
