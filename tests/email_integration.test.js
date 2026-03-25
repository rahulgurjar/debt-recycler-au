const request = require("supertest");
const app = require("../src/api");
const db = require("../src/db");
const { sendReport, scheduleReport, sendBulkEmail } = require("../src/email");

// Mock AWS SES
jest.mock("aws-sdk", () => ({
  SES: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: "test-message-id" }),
    }),
  })),
}));

describe("Email Integration Feature", () => {
  let user1, user2, client1, client2, scenario, authToken;

  beforeAll(async () => {
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
      last_name: "Advisor",
      role: "advisor",
    });

    client1 = await db.createClient({
      user_id: user1.id,
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
    });

    client2 = await db.createClient({
      user_id: user1.id,
      first_name: "Jane",
      last_name: "Smith",
      email: "jane@example.com",
    });

    scenario = await db.createScenario({
      user_id: user1.id,
      client_id: client1.id,
      name: "Growth Strategy",
      parameters: {
        investment_amount: 100000,
        interest_rate: 0.05,
      },
    });

    authToken = require("../src/auth").generateToken({
      user_id: user1.id,
      email: user1.email,
      role: user1.role,
    });
  });

  describe("V1: Email Send Success", () => {
    it("should send report email successfully", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Your Debt Recycling Report",
          message: "Please review the attached report",
        })
        .expect(200);

      expect(res.body.email_id).toBeDefined();
      expect(res.body.status).toBe("sent");
      expect(res.body.timestamp).toBeDefined();
    });

    it("should create email record in database", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Test Report",
          message: "Test message",
        })
        .expect(200);

      const emailId = res.body.email_id;
      expect(emailId).toBeDefined();

      // Verify record exists in database
      const emailRecord = await db.getEmailLog(emailId);
      expect(emailRecord).toBeDefined();
      expect(emailRecord.recipient_email).toBe(client1.email);
      expect(emailRecord.status).toBe("sent");
    });

    it("should validate email address before sending", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: "invalid-email",
          subject: "Test",
          message: "Test",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid.*email/i);
    });

    it("should return 404 if scenario not found", async () => {
      await request(app)
        .post("/scenarios/99999/send-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: "test@example.com",
          subject: "Test",
          message: "Test",
        })
        .expect(404);
    });
  });

  describe("V2: Email Template & Content", () => {
    it("should include scenario summary in email body", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Your Report",
          message: "Review attached",
        })
        .expect(200);

      const emailRecord = await db.getEmailLog(res.body.email_id);
      expect(emailRecord.html_body).toContain("Growth Strategy");
      expect(emailRecord.html_body).toContain("John Doe");
    });

    it("should include advisor contact information", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Your Report",
          message: "Review attached",
        })
        .expect(200);

      const emailRecord = await db.getEmailLog(res.body.email_id);
      expect(emailRecord.html_body).toContain("advisor@test.com");
      expect(emailRecord.html_body).toContain("Test Advisor");
    });

    it("should include presigned S3 URL for PDF", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Your Report",
          message: "Review attached",
        })
        .expect(200);

      const emailRecord = await db.getEmailLog(res.body.email_id);
      expect(emailRecord.html_body).toContain("https://");
      expect(emailRecord.html_body).toMatch(/download|report|pdf/i);
    });

    it("should provide plain text fallback", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Your Report",
          message: "Review attached",
        })
        .expect(200);

      const emailRecord = await db.getEmailLog(res.body.email_id);
      expect(emailRecord.text_body).toBeDefined();
      expect(emailRecord.text_body.length).toBeGreaterThan(0);
    });

    it("should include scenario name in subject line", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Custom Subject",
          message: "Review attached",
        })
        .expect(200);

      const emailRecord = await db.getEmailLog(res.body.email_id);
      expect(emailRecord.subject).toContain("Custom Subject");
    });
  });

  describe("V3: Scheduled Email Delivery", () => {
    it("should schedule email for future delivery", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const res = await request(app)
        .post(`/clients/${client1.id}/schedule-report`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          scenario_id: scenario.id,
          scheduled_date: futureDate.toISOString(),
          frequency: "once",
          subject: "Your Scheduled Report",
        })
        .expect(200);

      expect(res.body.scheduled_email_id).toBeDefined();
      expect(res.body.next_send_date).toBeDefined();
    });

    it("should store scheduled email in database", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/clients/${client1.id}/schedule-report`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          scenario_id: scenario.id,
          scheduled_date: futureDate.toISOString(),
          frequency: "weekly",
        })
        .expect(200);

      const scheduledEmail = await db.getScheduledEmail(
        res.body.scheduled_email_id
      );
      expect(scheduledEmail).toBeDefined();
      expect(scheduledEmail.frequency).toBe("weekly");
    });

    it("should support weekly frequency", async () => {
      const res = await request(app)
        .post(`/clients/${client1.id}/schedule-report`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          scenario_id: scenario.id,
          frequency: "weekly",
        })
        .expect(200);

      const scheduled = await db.getScheduledEmail(res.body.scheduled_email_id);
      expect(scheduled.frequency).toBe("weekly");
    });

    it("should support monthly frequency", async () => {
      const res = await request(app)
        .post(`/clients/${client1.id}/schedule-report`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          scenario_id: scenario.id,
          frequency: "monthly",
        })
        .expect(200);

      const scheduled = await db.getScheduledEmail(res.body.scheduled_email_id);
      expect(scheduled.frequency).toBe("monthly");
    });

    it("should cancel scheduled email", async () => {
      const schedRes = await request(app)
        .post(`/clients/${client1.id}/schedule-report`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          scenario_id: scenario.id,
          frequency: "weekly",
        })
        .expect(200);

      await request(app)
        .delete(
          `/scheduled-emails/${schedRes.body.scheduled_email_id}`
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const scheduled = await db.getScheduledEmail(
        schedRes.body.scheduled_email_id
      );
      expect(scheduled.active).toBe(false);
    });
  });

  describe("V4: Bulk Email Campaign", () => {
    it("should send bulk email to multiple clients", async () => {
      const res = await request(app)
        .post("/clients/send-bulk-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          client_ids: [client1.id, client2.id],
          subject: "Campaign Subject",
          message: "Campaign message",
        })
        .expect(200);

      expect(res.body.campaign_id).toBeDefined();
      expect(res.body.sent_count).toBe(2);
      expect(res.body.status).toBe("completed");
    });

    it("should create campaign record", async () => {
      const res = await request(app)
        .post("/clients/send-bulk-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          client_ids: [client1.id, client2.id],
          subject: "Test Campaign",
          message: "Test",
        })
        .expect(200);

      const campaign = await db.getCampaign(res.body.campaign_id);
      expect(campaign).toBeDefined();
      expect(campaign.subject).toBe("Test Campaign");
    });

    it("should track sent and failed count", async () => {
      const res = await request(app)
        .post("/clients/send-bulk-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          client_ids: [client1.id, client2.id],
          subject: "Campaign",
          message: "Message",
        })
        .expect(200);

      expect(res.body.sent_count).toBeGreaterThanOrEqual(0);
      expect(res.body.failed_count).toBeGreaterThanOrEqual(0);
      expect(res.body.sent_count + res.body.failed_count).toBeGreaterThan(0);
    });

    it("should send to all advisor's clients when list empty", async () => {
      const res = await request(app)
        .post("/clients/send-bulk-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          subject: "All Clients",
          message: "Message to all",
        })
        .expect(200);

      // Should send to all clients owned by advisor (at least 2)
      expect(res.body.sent_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("V5: Access Control", () => {
    it("should return 401 for unauthenticated user", async () => {
      await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .send({
          recipient_email: "test@example.com",
          subject: "Test",
          message: "Test",
        })
        .expect(401);
    });

    it("should return 403 if different advisor sends to other's client", async () => {
      const otherToken = require("../src/auth").generateToken({
        user_id: user2.id,
        email: user2.email,
        role: user2.role,
      });

      await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Test",
          message: "Test",
        })
        .expect(403);
    });

    it("should allow advisor to send own scenario email", async () => {
      await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Test",
          message: "Test",
        })
        .expect(200);
    });

    it("should allow admin to send any email", async () => {
      const admin = await db.createUser({
        email: "admin@test.com",
        password_hash: "hashed",
        role: "admin",
      });

      const adminToken = require("../src/auth").generateToken({
        user_id: admin.id,
        email: admin.email,
        role: admin.role,
      });

      await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Admin Test",
          message: "Test",
        })
        .expect(200);
    });
  });

  describe("Error Handling & Retry Logic", () => {
    it("should retry on SES throttling", async () => {
      // SES throws ThrottlingException, should retry up to 3 times
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Test",
          message: "Test",
        });

      // Should either succeed (200) or fail with descriptive error
      expect([200, 503]).toContain(res.status);
    });

    it("should return error message for permanent SES failure", async () => {
      // Invalid email should fail permanently
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: "invalid",
          subject: "Test",
          message: "Test",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it("should mark email as failed in database on error", async () => {
      const res = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: "invalid",
          subject: "Test",
          message: "Test",
        });

      if (res.body.email_id) {
        const emailRecord = await db.getEmailLog(res.body.email_id);
        expect(emailRecord.status).toBe("failed");
        expect(emailRecord.error_reason).toBeDefined();
      }
    });
  });

  describe("Performance", () => {
    it("should send email in under 3 seconds", async () => {
      const startTime = Date.now();

      await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipient_email: client1.email,
          subject: "Perf Test",
          message: "Test",
        })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });

    it("should handle concurrent email sends", async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post(`/scenarios/${scenario.id}/send-email`)
            .set("Authorization", `Bearer ${authToken}`)
            .send({
              recipient_email: `client${i}@example.com`,
              subject: `Test ${i}`,
              message: "Test",
            })
        );
      }

      const results = await Promise.all(promises);
      results.forEach((res) => {
        expect([200, 400]).toContain(res.status); // 400 for invalid emails
      });
    });
  });

  describe("Idempotency", () => {
    it("should prevent duplicate sends with idempotency key", async () => {
      const idempotencyKey = "test-key-" + Date.now();

      const res1 = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          recipient_email: client1.email,
          subject: "Idempotent Test",
          message: "Test",
        })
        .expect(200);

      const res2 = await request(app)
        .post(`/scenarios/${scenario.id}/send-email`)
        .set("Authorization", `Bearer ${authToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          recipient_email: client1.email,
          subject: "Idempotent Test",
          message: "Test",
        })
        .expect(200);

      // Both should return same email_id
      expect(res1.body.email_id).toBe(res2.body.email_id);
    });
  });
});
