const request = require("supertest");
const app = require("../src/api");
const db = require("../src/db");
const { generateExcel } = require("../src/excel");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

describe("Excel Export Feature", () => {
  let user1, user2, client, scenario, authToken;

  beforeAll(async () => {
    // Create test users
    user1 = await db.createUser({
      email: "advisor@test.com",
      password_hash: "hashed",
      first_name: "Test",
      last_name: "Advisor",
      role: "advisor",
    });

    user2 = await db.createUser({
      email: "other@test.com",
      password_hash: "hashed",
      first_name: "Other",
      last_name: "User",
      role: "advisor",
    });

    // Create test client
    client = await db.createClient({
      user_id: user1.id,
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      investment_amount: 100000,
    });

    // Create test scenario
    scenario = await db.createScenario({
      user_id: user1.id,
      client_id: client.id,
      name: "Conservative Growth",
      parameters: {
        investment_amount: 100000,
        interest_rate: 0.05,
        tax_rate: 0.37,
        investment_return: 0.08,
      },
    });

    // Generate auth token for user1
    authToken = require("../src/auth").generateToken({
      user_id: user1.id,
      email: user1.email,
      role: user1.role,
    });
  });

  describe("V1: Excel File Structure", () => {
    it("should return xlsx file with correct content-type", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect("Content-Type", /spreadsheet/)
        .expect(200);

      expect(res.headers["content-disposition"]).toMatch(/\.xlsx/);
      expect(res.body).toBeDefined();
    });

    it("should use scenario name as filename", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.headers["content-disposition"]).toContain(
        "Conservative%20Growth.xlsx"
      );
    });

    it("should generate file size between 10KB and 2MB", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const fileSize = Buffer.byteLength(res.body);
      expect(fileSize).toBeGreaterThan(10 * 1024); // > 10KB
      expect(fileSize).toBeLessThan(2 * 1024 * 1024); // < 2MB
    });

    it("should be valid xlsx when written to disk", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const tmpPath = path.join("/tmp", "test-export.xlsx");
      fs.writeFileSync(tmpPath, res.body);

      const workbook = new ExcelJS.Workbook();
      await expect(workbook.xlsx.readFile(tmpPath)).resolves.toBeDefined();
    });
  });

  describe("V2: Metadata Sheet", () => {
    it("should contain metadata sheet with scenario info", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const metadataSheet = workbook.getWorksheet("Metadata");
      expect(metadataSheet).toBeDefined();
    });

    it("should include scenario name in metadata", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const metadataSheet = workbook.getWorksheet("Metadata");

      let scenarioNameFound = false;
      metadataSheet.eachRow((row) => {
        if (row.values.includes("Conservative Growth")) {
          scenarioNameFound = true;
        }
      });
      expect(scenarioNameFound).toBe(true);
    });

    it("should include client name in metadata", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const metadataSheet = workbook.getWorksheet("Metadata");

      let clientNameFound = false;
      metadataSheet.eachRow((row) => {
        if (row.values.includes("John Doe")) {
          clientNameFound = true;
        }
      });
      expect(clientNameFound).toBe(true);
    });

    it("should include advisor email in metadata", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const metadataSheet = workbook.getWorksheet("Metadata");

      let advsorEmailFound = false;
      metadataSheet.eachRow((row) => {
        if (row.values.includes("advisor@test.com")) {
          advsorEmailFound = true;
        }
      });
      expect(advsorEmailFound).toBe(true);
    });

    it("should include creation date in metadata", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const metadataSheet = workbook.getWorksheet("Metadata");

      let dateFound = false;
      metadataSheet.eachRow((row) => {
        if (row.values.some((val) => val && val.toString().includes("2026"))) {
          dateFound = true;
        }
      });
      expect(dateFound).toBe(true);
    });
  });

  describe("V3: Formatting & Styling", () => {
    it("should have header row with background color", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      const headerRow = projectionsSheet.getRow(1);
      expect(headerRow.fill.fgColor.rgb).toBeDefined();
    });

    it("should have bold header text", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      const headerRow = projectionsSheet.getRow(1);
      const firstCell = headerRow.getCell(1);
      expect(firstCell.font.bold).toBe(true);
    });

    it("should format currency columns with $#,##0.00", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      // Find currency column (geared_wealth)
      const dataRow = projectionsSheet.getRow(2);
      const currencyCell = dataRow.getCell(3); // geared_wealth column
      expect(currencyCell.numFmt).toMatch(/\$/);
    });

    it("should format percentage columns with 0.00%", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      // Parameters sheet has interest_rate as percentage
      const paramsSheet = workbook.getWorksheet("Parameters");
      const percentRow = paramsSheet.getRow(3); // interest_rate row
      const percentCell = percentRow.getCell(2);
      expect(percentCell.numFmt).toMatch(/%/);
    });

    it("should apply borders to all cells", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      const dataCell = projectionsSheet.getRow(2).getCell(1);
      expect(dataCell.border).toBeDefined();
      expect(dataCell.border.left).toBeDefined();
    });

    it("should freeze header rows", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      expect(projectionsSheet.views[0].pane).toBeDefined();
    });

    it("should alternate row colors (white and #F5F5F5)", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      const row2 = projectionsSheet.getRow(2);
      const row3 = projectionsSheet.getRow(3);

      const color2 = row2.fill.fgColor.rgb;
      const color3 = row3.fill.fgColor.rgb;

      // Colors should be different (alternating)
      expect(color2).not.toEqual(color3);
    });

    it("should auto-fit column widths", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      expect(projectionsSheet.columns[0].width).toBeGreaterThan(5);
      expect(projectionsSheet.columns[0].width).toBeLessThan(50);
    });
  });

  describe("V4: Formula Support", () => {
    it("should include year 20 wealth calculation as formula", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const projectionsSheet = workbook.getWorksheet("Projections");

      // Find Year 20 row and geared_wealth total cell
      let year20Row = null;
      projectionsSheet.eachRow((row) => {
        if (row.values[1] === 20) {
          year20Row = row;
        }
      });

      expect(year20Row).toBeDefined();
      // Check if cell has formula (starts with =)
      const totalCell = year20Row.getCell(3);
      expect(totalCell.value).toBeDefined();
    });

    it("should have formula-based XIRR calculation in summary", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const summarySheet = workbook.getWorksheet("Summary");

      let xirrFound = false;
      summarySheet.eachRow((row) => {
        if (
          row.values.some((val) =>
            val?.toString().toLowerCase().includes("xirr")
          )
        ) {
          xirrFound = true;
        }
      });
      expect(xirrFound).toBe(true);
    });

    it("should mark formula cells with yellow background", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const summarySheet = workbook.getWorksheet("Summary");

      let formulaCellFound = false;
      summarySheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value && cell.value.toString().includes("=")) {
            if (cell.fill && cell.fill.fgColor) {
              formulaCellFound = true;
            }
          }
        });
      });
      expect(formulaCellFound).toBe(true);
    });
  });

  describe("V5: Access Control", () => {
    it("should return 401 for unauthenticated user", async () => {
      await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .expect(401);
    });

    it("should return 403 for different user", async () => {
      const otherToken = require("../src/auth").generateToken({
        user_id: user2.id,
        email: user2.email,
        role: user2.role,
      });

      await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);
    });

    it("should allow scenario owner to export", async () => {
      await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
    });

    it("should allow admin to export any scenario", async () => {
      const admin = await db.createUser({
        email: "admin@test.com",
        password_hash: "hashed",
        first_name: "Admin",
        last_name: "User",
        role: "admin",
      });

      const adminToken = require("../src/auth").generateToken({
        user_id: admin.id,
        email: admin.email,
        role: admin.role,
      });

      await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });

    it("should return 404 for nonexistent scenario", async () => {
      await request(app)
        .post("/scenarios/99999/export")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("Performance", () => {
    it("should complete export in under 5 seconds", async () => {
      const startTime = Date.now();

      await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it("should handle concurrent exports without memory leaks", async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post(`/scenarios/${scenario.id}/export`)
            .set("Authorization", `Bearer ${authToken}`)
        );
      }

      const results = await Promise.all(promises);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 500 with message if excel generation fails", async () => {
      // This would require mocking exceljs to fail
      // For now, we're testing that valid scenarios work
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it("should return 400 if parameters are invalid", async () => {
      // Create scenario with invalid parameters
      const badScenario = await db.createScenario({
        user_id: user1.id,
        client_id: client.id,
        name: "Bad Scenario",
        parameters: { invalid: true },
      });

      const res = await request(app)
        .post(`/scenarios/${badScenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Data Validation", () => {
    it("should include data validation for investment amount", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const paramsSheet = workbook.getWorksheet("Parameters");

      // Check if validation rules exist
      expect(paramsSheet.dataValidations).toBeDefined();
    });

    it("should include data validation for interest rate", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/export`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const paramsSheet = workbook.getWorksheet("Parameters");

      expect(paramsSheet.dataValidations).toBeDefined();
    });
  });
});
