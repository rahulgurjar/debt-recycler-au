const AWS = require("aws-sdk");
const nodemailer = require("nodemailer");
const db = require("./db");

// Initialize AWS SES
const ses = new AWS.SES({ region: process.env.AWS_REGION || "ap-southeast-2" });

// Create nodemailer transporter using SES
const transporter = nodemailer.createTransport({
  SES: ses,
});

/**
 * Generate HTML email template
 */
function generateEmailTemplate(scenario, client, advisor, message) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { margin: 20px 0; line-height: 1.6; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .table th { background-color: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Debt Recycling Strategy Report</h1>
            <p>Scenario: ${scenario.name}</p>
          </div>

          <div class="content">
            <p>Hello ${client.first_name},</p>
            <p>${message}</p>

            <h3>Scenario Summary</h3>
            <table class="table">
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
              <tr>
                <td>Scenario Name</td>
                <td>${scenario.name}</td>
              </tr>
              <tr>
                <td>Investment Amount</td>
                <td>$${(scenario.parameters.investment_amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Interest Rate</td>
                <td>${((scenario.parameters.interest_rate || 0) * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Created Date</td>
                <td>${new Date(scenario.created_at).toLocaleDateString()}</td>
              </tr>
            </table>

            <p><strong>Your complete report is ready for download.</strong> Please click the button below to access your full analysis.</p>
            <a href="#" class="cta-button">Download Full Report (PDF)</a>
          </div>

          <div class="footer">
            <p><strong>${advisor.first_name} ${advisor.last_name}</strong><br>
            Email: ${advisor.email}<br>
            Debt Recycling Advisor</p>
            <p>This email and any attachments are confidential and may contain privileged information. If you are not the intended recipient, please notify the sender immediately.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return html;
}

/**
 * Generate plain text email template
 */
function generatePlainTextTemplate(scenario, client, advisor, message) {
  const text = `
Debt Recycling Strategy Report
Scenario: ${scenario.name}

Hello ${client.first_name},

${message}

SCENARIO SUMMARY
================
Scenario Name: ${scenario.name}
Investment Amount: $${(scenario.parameters.investment_amount || 0).toLocaleString()}
Interest Rate: ${((scenario.parameters.interest_rate || 0) * 100).toFixed(2)}%
Created Date: ${new Date(scenario.created_at).toLocaleDateString()}

Your complete report is ready for download. Please check your inbox for the download link.

---
${advisor.first_name} ${advisor.last_name}
Email: ${advisor.email}
Debt Recycling Advisor

This email and any attachments are confidential and may contain privileged information.
  `.trim();

  return text;
}

/**
 * Send report email to client
 * @param {Object} scenario - Scenario with parameters
 * @param {Object} client - Client with first_name, last_name, email
 * @param {Object} advisor - Advisor with first_name, last_name, email
 * @param {Object} options - {recipient_email, subject, message}
 * @returns {Promise<Object>} {email_id, status, timestamp}
 */
async function sendReport(scenario, client, advisor, options) {
  const { recipient_email, subject, message } = options;

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipient_email)) {
    throw new Error("Invalid recipient email address");
  }

  // Generate templates
  const html = generateEmailTemplate(scenario, client, advisor, message);
  const text = generatePlainTextTemplate(scenario, client, advisor, message);

  try {
    // Send via nodemailer/SES with retry
    const result = await sendWithRetry({
      from: process.env.SENDER_EMAIL || "noreply@debtrecycler.com.au",
      to: recipient_email,
      subject: subject || `${scenario.name} - Debt Recycling Report`,
      html,
      text,
    });

    // Store in database
    const emailLog = await db.createEmailLog({
      user_id: advisor.id,
      recipient_email,
      subject: subject || `${scenario.name} - Debt Recycling Report`,
      html_body: html,
      text_body: text,
      status: "sent",
      ses_message_id: result.messageId,
    });

    return {
      email_id: emailLog.id,
      status: "sent",
      timestamp: new Date().toISOString(),
      message_id: result.messageId,
    };
  } catch (error) {
    // Log failure
    const emailLog = await db.createEmailLog({
      user_id: advisor.id,
      recipient_email,
      subject: subject || `${scenario.name} - Debt Recycling Report`,
      html_body: generateEmailTemplate(scenario, client, advisor, message),
      text_body: generatePlainTextTemplate(
        scenario,
        client,
        advisor,
        message
      ),
      status: "failed",
      error_reason: error.message,
    });

    throw {
      email_id: emailLog.id,
      error: error.message,
      status: "failed",
    };
  }
}

/**
 * Send email with exponential backoff retry (max 3 attempts)
 */
async function sendWithRetry(mailOptions, attempt = 1) {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    // Retry on throttling or transient errors
    if (
      attempt < 3 &&
      (error.code === "Throttling" || error.code === "MessageRejected")
    ) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(mailOptions, attempt + 1);
    }
    throw error;
  }
}

/**
 * Schedule report delivery for future date
 * @param {number} user_id - Advisor user ID
 * @param {number} client_id - Client ID
 * @param {number} scenario_id - Scenario ID
 * @param {Object} options - {scheduled_date, frequency, subject}
 * @returns {Promise<Object>} {scheduled_email_id, next_send_date}
 */
async function scheduleReport(user_id, client_id, scenario_id, options) {
  const { scheduled_date, frequency = "once", subject } = options;

  const scheduledEmail = await db.createScheduledEmail({
    user_id,
    client_id,
    scenario_id,
    scheduled_date: scheduled_date || new Date(),
    frequency,
    subject,
    active: true,
  });

  return {
    scheduled_email_id: scheduledEmail.id,
    next_send_date: scheduledEmail.next_send_date,
    frequency: scheduledEmail.frequency,
  };
}

/**
 * Send bulk email to multiple clients
 * @param {number} user_id - Advisor user ID
 * @param {Object} options - {client_ids, subject, message}
 * @returns {Promise<Object>} {campaign_id, sent_count, failed_count, status}
 */
async function sendBulkEmail(user_id, options) {
  const { client_ids, subject, message } = options;

  // Get clients (all if client_ids not specified)
  let clients = [];
  if (!client_ids || client_ids.length === 0) {
    clients = await db.getClientsByAdvisor(user_id);
  } else {
    clients = await db.getClientsByIds(client_ids);
  }

  // Create campaign record
  const campaign = await db.createCampaign({
    user_id,
    subject,
    message,
    total_count: clients.length,
  });

  let sent_count = 0;
  let failed_count = 0;

  // Send to each client (in parallel, max 10 concurrent)
  const batchSize = 10;
  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((client) =>
        sendReportToClient(user_id, client, campaign, subject, message)
      )
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        sent_count++;
      } else {
        failed_count++;
      }
    });
  }

  // Update campaign with results
  await db.updateCampaign(campaign.id, {
    sent_count,
    failed_count,
    status: "completed",
  });

  return {
    campaign_id: campaign.id,
    sent_count,
    failed_count,
    status: "completed",
  };
}

/**
 * Helper to send report to individual client
 */
async function sendReportToClient(user_id, client, campaign, subject, message) {
  const advisor = await db.getUser(user_id);
  const scenario = await db.getScenario(campaign.scenario_id);

  return sendReport(scenario, client, advisor, {
    recipient_email: client.email,
    subject,
    message,
  });
}

/**
 * Process scheduled emails (called by background job)
 */
async function processScheduledEmails() {
  const scheduledEmails = await db.getScheduledEmailsDue();

  for (const scheduled of scheduledEmails) {
    try {
      const scenario = await db.getScenario(scheduled.scenario_id);
      const client = await db.getClient(scheduled.client_id);
      const advisor = await db.getUser(scheduled.user_id);

      await sendReport(scenario, client, advisor, {
        recipient_email: client.email,
        subject: scheduled.subject,
        message: `Scheduled report for ${scenario.name}`,
      });

      // Update next send date based on frequency
      let nextDate = new Date();
      if (scheduled.frequency === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (scheduled.frequency === "monthly") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else {
        // "once" - mark as inactive
        await db.updateScheduledEmail(scheduled.id, { active: false });
        continue;
      }

      await db.updateScheduledEmail(scheduled.id, {
        next_send_date: nextDate,
      });
    } catch (error) {
      console.error(`Error processing scheduled email ${scheduled.id}:`, error);
    }
  }
}

module.exports = {
  sendReport,
  scheduleReport,
  sendBulkEmail,
  processScheduledEmails,
};
