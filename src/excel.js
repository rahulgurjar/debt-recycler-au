const ExcelJS = require("exceljs");
const { calculate } = require("./calculator");

/**
 * Generate professional Excel workbook for scenario
 * @param {Object} scenario - Scenario with id, name, parameters, created_at
 * @param {Object} client - Client with first_name, last_name, email
 * @param {Object} user - User with email
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateExcel(scenario, client, user) {
  const workbook = new ExcelJS.Workbook();

  // Calculate projections using debt recycling calculator
  const projections = calculate(scenario.parameters);

  // Create Metadata sheet
  createMetadataSheet(workbook, scenario, client, user);

  // Create Parameters sheet
  createParametersSheet(workbook, scenario.parameters);

  // Create Projections sheet
  createProjectionsSheet(workbook, projections);

  // Create Summary sheet
  createSummarySheet(workbook, projections);

  // Convert workbook to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Create metadata sheet with scenario details
 */
function createMetadataSheet(workbook, scenario, client, user) {
  const sheet = workbook.addWorksheet("Metadata");

  const rows = [
    ["Scenario Name", scenario.name],
    ["Client Name", `${client.first_name} ${client.last_name}`.trim()],
    ["Client Email", client.email],
    ["Advisor Email", user.email],
    ["Created Date", new Date(scenario.created_at).toISOString().split("T")[0]],
    ["Exported Date", new Date().toISOString().split("T")[0]],
  ];

  rows.forEach((row, index) => {
    const cellRow = sheet.addRow(row);
    cellRow.getCell(1).font = { bold: true };
    cellRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb:"FFE7F0F7" },
    };
  });

  sheet.columns[0].width = 20;
  sheet.columns[1].width = 40;

  applyBorders(sheet);
}

/**
 * Create parameters sheet with input values
 */
function createParametersSheet(workbook, parameters) {
  const sheet = workbook.addWorksheet("Parameters");

  // Header row
  const headerRow = sheet.addRow(["Parameter", "Value"]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb:"FFE7F0F7" },
  };

  // Parameters
  const params = [
    ["Investment Amount", parameters.investment_amount, "$#,##0.00"],
    ["Interest Rate (%)", parameters.interest_rate * 100, "0.00%"],
    ["Investment Return (%)", parameters.investment_return * 100, "0.00%"],
    ["Tax Rate (%)", parameters.tax_rate * 100, "0.00%"],
  ];

  params.forEach((param, index) => {
    const row = sheet.addRow([param[0], param[1]]);
    row.getCell(2).numFmt = param[2];

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb:"FFFFFFFF" },
      };
    } else {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb:"FFF5F5F5" },
      };
    }

    // Add data validation to investment amount
    if (param[0] === "Investment Amount") {
      sheet.dataValidations.add('B2', {
        type: "decimal",
        operator: "between",
        formula1: 10000,
        formula2: 5000000,
        showInputMessage: true,
        promptTitle: "Investment Amount",
        prompt: "Enter amount between $10,000 and $5,000,000",
        showErrorMessage: true,
        errorTitle: "Invalid Amount",
        error: "Enter valid investment amount ($10k - $5M)",
      });
    }

    // Add data validation to interest rate
    if (param[0] === "Interest Rate (%)") {
      sheet.dataValidations.add('B4', {
        type: "decimal",
        operator: "between",
        formula1: 0.1,
        formula2: 20,
        showInputMessage: true,
        promptTitle: "Interest Rate",
        prompt: "Enter rate between 0.1% and 20%",
      });
    }
  });

  sheet.columns[0].width = 25;
  sheet.columns[1].width = 25;
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', pane: { ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' } }];

  applyBorders(sheet);
}

/**
 * Create projections sheet with year-by-year data
 */
function createProjectionsSheet(workbook, projections) {
  const sheet = workbook.addWorksheet("Projections");

  // Header row
  const headerRow = sheet.addRow([
    "Year",
    "Geared Wealth",
    "Tax Benefit",
    "Cumulative Benefit",
    "Investment Return %",
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb:"FFE7F0F7" },
  };

  let cumulativeBenefit = 0;
  projections.years.forEach((yearData, index) => {
    cumulativeBenefit += yearData.after_tax_dividend || 0;
    const investmentReturnPct = yearData.pf_value > 0
      ? (yearData.after_tax_dividend || 0) / yearData.pf_value
      : 0;
    const row = sheet.addRow([
      yearData.year,
      yearData.wealth,
      yearData.after_tax_dividend || 0,
      cumulativeBenefit,
      investmentReturnPct,
    ]);

    // Format numbers
    row.getCell(2).numFmt = '$#,##0.00'; // geared_wealth
    row.getCell(3).numFmt = '$#,##0.00'; // tax_benefit
    row.getCell(4).numFmt = '$#,##0.00'; // cumulative_benefit
    row.getCell(5).numFmt = '0.00%'; // investment_return_pct

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb:"FFFFFFFF" },
      };
    } else {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb:"FFF5F5F5" },
      };
    }
  });

  // Set column widths
  sheet.columns[0].width = 12;
  sheet.columns[1].width = 18;
  sheet.columns[2].width = 18;
  sheet.columns[3].width = 22;
  sheet.columns[4].width = 20;

  // Freeze header
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', pane: { ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' } }];

  applyBorders(sheet);
}

/**
 * Create summary sheet with calculated totals and XIRR
 */
function createSummarySheet(workbook, projections) {
  const sheet = workbook.addWorksheet("Summary");

  const totalTaxBenefit = projections.years.reduce((sum, y) => sum + (y.after_tax_dividend || 0), 0);
  const xirr = (projections.xirr || 0) * 100;
  const summaryData = [
    ["Year 0 Wealth", projections.years[0]?.wealth || 0],
    ["Year 20 Wealth", projections.years[20]?.wealth || 0],
    ["Total Tax Benefit", totalTaxBenefit],
    ["XIRR (%)", `=${xirr.toFixed(4)}%`],
    ["Cumulative Growth", projections.final_wealth || 0],
  ];

  summaryData.forEach((item, index) => {
    const row = sheet.addRow([item[0], item[1]]);
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb:"FFE7F0F7" },
    };

    // Format currency/percentage
    if (item[0].includes("XIRR")) {
      row.getCell(2).numFmt = "0.00%";
    } else {
      row.getCell(2).numFmt = "$#,##0.00";
    }

    // Mark calculated cells with yellow background
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb:"FFFFFF00" }, // yellow
    };
  });

  sheet.columns[0].width = 25;
  sheet.columns[1].width = 25;

  applyBorders(sheet);
}

/**
 * Apply borders to all cells in sheet
 */
function applyBorders(sheet) {
  const borderStyle = {
    style: "thin",
    color: { argb:"FFCCCCCC" },
  };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: borderStyle,
        left: borderStyle,
        bottom: borderStyle,
        right: borderStyle,
      };
    });
  });
}

module.exports = { generateExcel };
