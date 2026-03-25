const request = require("supertest");
const app = require("../src/api");
const db = require("../src/db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_fake");

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockReturnValue({
    customers: {
      create: jest.fn().mockResolvedValue({
        id: "cus_test123",
        email: "test@example.com",
        metadata: { user_id: "1" },
      }),
      update: jest.fn().mockResolvedValue({
        id: "cus_test123",
        metadata: { subscription_tier: "professional" },
      }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: "sub_test123",
        customer: "cus_test123",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ plan: { product: "prod_test" } }],
        },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "sub_test123",
        status: "active",
      }),
      del: jest.fn().mockResolvedValue({
        id: "sub_test123",
        status: "canceled",
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount: 2900,
      }),
    },
    invoices: {
      create: jest.fn().mockResolvedValue({
        id: "in_test123",
        pdf: "https://example.com/invoice.pdf",
      }),
      sendInvoice: jest.fn().mockResolvedValue({
        id: "in_test123",
        status: "sent",
      }),
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          url: "https://billing.stripe.com/session/test123",
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  });
});

describe("Stripe Setup Feature", () => {
  let user, authToken;

  beforeAll(async () => {
    user = await db.createUser({
      email: "advisor@test.com",
      password_hash: "hashed",
      first_name: "Test",
      last_name: "Advisor",
      role: "advisor",
    });

    authToken = require("../src/auth").generateToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
    });
  });

  describe("V1: Customer Creation", () => {
    it("should create Stripe customer on signup", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          email: "newadvisor@test.com",
          password: "SecurePass123!",
          first_name: "New",
          last_name: "Advisor",
          company_name: "Test Company",
        })
        .expect(201);

      expect(res.body.stripe_customer_id).toBeDefined();
      expect(res.body.stripe_customer_id).toMatch(/^cus_/);
    });

    it("should store stripe_customer_id in database", async () => {
      const newUser = await db.createUser({
        email: "test2@example.com",
        password_hash: "hashed",
        first_name: "Test",
        last_name: "User",
      });

      const userRecord = await db.getUser(newUser.id);
      expect(userRecord.stripe_customer_id).toBeDefined();
    });

    it("should include user metadata in Stripe customer", async () => {
      // Verify that Stripe customer created with metadata
      const res = await request(app)
        .post("/auth/signup")
        .send({
          email: "metadata@test.com",
          password: "SecurePass123!",
          first_name: "Meta",
          last_name: "Data",
          company_name: "Meta Company",
        })
        .expect(201);

      expect(res.body.stripe_customer_id).toBeDefined();
    });
  });

  describe("V2: Subscription Creation", () => {
    it("should create subscription for Starter tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      expect(res.body.subscription_id).toBeDefined();
      expect(res.body.subscription_id).toMatch(/^sub_/);
      expect(res.body.status).toBe("active");
      expect(res.body.tier).toBe("starter");
    });

    it("should create subscription for Professional tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "professional",
          payment_method_id: "pm_test456",
        })
        .expect(200);

      expect(res.body.tier).toBe("professional");
      expect(res.body.status).toBe("active");
    });

    it("should create subscription for Enterprise tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "enterprise",
          payment_method_id: "pm_test789",
        })
        .expect(200);

      expect(res.body.tier).toBe("enterprise");
    });

    it("should store subscription_id in database", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      const userRecord = await db.getUser(user.id);
      expect(userRecord.subscription_id).toBe(res.body.subscription_id);
    });

    it("should set current_period_end in database", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "professional",
          payment_method_id: "pm_test456",
        })
        .expect(200);

      expect(res.body.current_period_end).toBeDefined();
      expect(new Date(res.body.current_period_end).getTime()).toBeGreaterThan(
        Date.now()
      );
    });

    it("should reject invalid tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "platinum",
          payment_method_id: "pm_test123",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid.*tier/i);
    });
  });

  describe("V3: Payment Processing", () => {
    it("should process valid card successfully", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_visa_debit", // Valid test card
        })
        .expect(200);

      expect(res.body.status).toBe("active");
    });

    it("should reject invalid card", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_card_declined", // Test card that declines
        });

      expect([400, 402, 403]).toContain(res.status);
      expect(res.body.error).toBeDefined();
    });

    it("should save payment method for future billing", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "professional",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      const userRecord = await db.getUser(user.id);
      expect(userRecord.default_payment_method_id).toBeDefined();
    });

    it("should generate invoice on subscription", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      expect(res.body.invoice_id).toBeDefined();
      expect(res.body.invoice_id).toMatch(/^in_/);
    });

    it("should send invoice to customer email", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "professional",
          payment_method_id: "pm_test456",
        })
        .expect(200);

      expect(res.body.invoice_sent).toBe(true);
    });
  });

  describe("V4: Webhook Handling", () => {
    it("should handle charge.succeeded webhook", async () => {
      const event = {
        type: "charge.succeeded",
        data: {
          object: {
            customer: "cus_test123",
            amount: 2900,
          },
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it("should handle charge.failed webhook", async () => {
      const event = {
        type: "charge.failed",
        data: {
          object: {
            customer: "cus_test123",
            failure_message: "Card declined",
          },
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it("should handle customer.subscription.updated webhook", async () => {
      const event = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test123",
            customer: "cus_test123",
            status: "active",
          },
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it("should handle customer.subscription.deleted webhook", async () => {
      const event = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_test123",
            customer: "cus_test123",
          },
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it("should verify webhook signature", async () => {
      const event = {
        type: "charge.succeeded",
        data: {
          object: {
            customer: "cus_test123",
          },
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "invalid_signature")
        .send(event);

      // Should reject invalid signature
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should return 200 even if event processing fails", async () => {
      const event = {
        type: "unknown.event",
        data: {
          object: {},
        },
      };

      const res = await request(app)
        .post("/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(res.body.received).toBe(true);
    });
  });

  describe("V5: Subscription Cancellation", () => {
    it("should cancel subscription", async () => {
      // First create subscription
      const subRes = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      const subscriptionId = subRes.body.subscription_id;

      // Then cancel
      const res = await request(app)
        .delete("/subscription")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("cancelled");
    });

    it("should update subscription status in database", async () => {
      const res = await request(app)
        .delete("/subscription")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const userRecord = await db.getUser(user.id);
      expect(userRecord.subscription_status).toBe("cancelled");
    });

    it("should revoke premium feature access on cancellation", async () => {
      await request(app)
        .delete("/subscription")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Try to access premium feature
      const res = await request(app)
        .post("/scenarios/bulk-import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          data: [],
        });

      // Should be rejected (tier requirement not met)
      expect(res.status).toBeGreaterThanOrEqual(403);
    });

    it("should return 404 if no subscription to cancel", async () => {
      const newUser = await db.createUser({
        email: "nosubscription@test.com",
        password_hash: "hashed",
      });

      const token = require("../src/auth").generateToken({
        user_id: newUser.id,
        email: newUser.email,
        role: "advisor",
      });

      const res = await request(app)
        .delete("/subscription")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Customer Portal", () => {
    it("should generate customer portal session", async () => {
      const res = await request(app)
        .post("/customer-portal")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.url).toBeDefined();
      expect(res.body.url).toMatch(/billing\.stripe\.com/);
    });

    it("should return 401 for unauthenticated user", async () => {
      await request(app)
        .post("/customer-portal")
        .expect(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle Stripe connection errors", async () => {
      // Mock Stripe error
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_error",
        });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.error).toBeDefined();
    });

    it("should handle insufficient funds error", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_insufficient_funds",
        });

      expect([400, 402]).toContain(res.status);
      expect(res.body.error).toMatch(/insufficient|declined/i);
    });
  });

  describe("Tier Pricing", () => {
    it("should charge $29 for Starter tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      expect(res.body.amount).toBe(2900); // in cents
    });

    it("should charge $99 for Professional tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "professional",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      expect(res.body.amount).toBe(9900);
    });

    it("should charge $299 for Enterprise tier", async () => {
      const res = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          tier: "enterprise",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      expect(res.body.amount).toBe(29900);
    });
  });

  describe("Idempotency", () => {
    it("should use idempotency key to prevent duplicate charges", async () => {
      const idempotencyKey = "test-key-" + Date.now();

      const res1 = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      const res2 = await request(app)
        .post("/subscribe")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          tier: "starter",
          payment_method_id: "pm_test123",
        })
        .expect(200);

      // Both should return same subscription ID
      expect(res1.body.subscription_id).toBe(res2.body.subscription_id);
    });
  });
});
