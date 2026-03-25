const PDFDocument = require('pdfkit');
const AWS = require('aws-sdk');
const { Pool } = require('pg');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'debt_recycler',
  ssl: { rejectUnauthorized: false },
});

async function generatePDFReport(scenario, client, options = {}) {
  const {
    title = 'Debt Recycling Strategy Report',
    include_company_branding = false,
    company_name = null,
  } = options;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    const generatedDate = new Date().toISOString().split('T')[0];

    doc.fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);

    if (include_company_branding && company_name) {
      doc.fontSize(12).font('Helvetica').text(company_name, { align: 'center' });
    }

    doc.fontSize(10).text(`Generated: ${generatedDate}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Client Information');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${client.name}`);
    doc.text(`Email: ${client.email}`);
    doc.text(`Risk Profile: ${client.risk_profile}`);
    doc.moveDown(0.8);

    doc.fontSize(14).font('Helvetica-Bold').text('Scenario Details');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Scenario Name: ${scenario.name}`);
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Strategy Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Initial Outlay: $${scenario.initial_outlay.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    doc.text(`Initial Loan: $${scenario.initial_loan.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    doc.text(`Gearing Ratio: ${(scenario.gearing_ratio * 100).toFixed(1)}%`);
    doc.text(`Annual Investment: $${scenario.annual_investment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    doc.text(`LOC Interest Rate: ${(scenario.loc_interest_rate * 100).toFixed(2)}%`);
    doc.text(`ETF Dividend Rate: ${(scenario.etf_dividend_rate * 100).toFixed(2)}%`);
    doc.text(`ETF Capital Appreciation: ${(scenario.etf_capital_appreciation * 100).toFixed(2)}%`);
    doc.text(`Marginal Tax Rate: ${(scenario.marginal_tax * 100).toFixed(1)}%`);
    doc.moveDown(0.8);

    doc.fontSize(12).font('Helvetica-Bold').text('20-Year Projection Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Final Wealth: $${scenario.final_wealth.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    doc.text(`XIRR: ${(scenario.xirr * 100).toFixed(2)}%`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Important Disclaimer');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text('This report is not financial advice. The projections contained herein are based on assumptions and historical data and may not be indicative of future performance. Past performance is not a guarantee of future results. Investors should consult with a licensed financial advisor before making investment decisions. This strategy involves leveraged investment, which increases both potential returns and risks. The use of debt to amplify investment returns may not be suitable for all investors.', {
      align: 'left',
      width: 500,
    });
    doc.moveDown(1);

    doc.fontSize(9).text('© 2026 Financial Advisory Services. All rights reserved.', { align: 'center' });

    doc.end();
  });
}

async function saveReportToDatabase(scenarioId, filename, s3Url, userId) {
  try {
    const result = await pool.query(
      `INSERT INTO scenario_reports (scenario_id, filename, s3_url, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, scenario_id, filename, s3_url, created_at`,
      [scenarioId, filename, s3Url, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving report to database:', error);
    throw error;
  }
}

async function uploadPDFToS3(pdfBuffer, filename) {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return null;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'debt-recycler-reports',
      Key: `reports/${filename}`,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ACL: 'private',
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('Error uploading PDF to S3:', error);
    return null;
  }
}

module.exports = {
  generatePDFReport,
  saveReportToDatabase,
  uploadPDFToS3,
};
