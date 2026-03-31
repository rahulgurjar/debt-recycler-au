const request = require("supertest");
const app = require("../src/api");

let adminToken;
let clientId;
let portalToken;

beforeAll(async () => {
  const signup = await request(app)
    .post("/auth/signup")
    .send({ email: "portal-admin@test.com", password: "TestPass123!", company_name: "Portal Co" });
  adminToken = signup.body.token;

  const client = await request(app)
    .post("/clients")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Portal Client", email: "portal-client@test.com", dob: "1980-01-01", annual_income: 100000, risk_profile: "moderate" });
  clientId = client.body.client?.id;
});

describe("Client Portal API", () => {
  describe("POST /portal/generate", () => {
    it("should generate portal token for a valid client", async () => {
      const res = await request(app)
        .post("/portal/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ client_id: clientId });

      expect(res.status).toBe(200);
      expect(res.body.portal_token).toBeDefined();
      expect(res.body.portal_url).toContain("portal_token=");
      expect(res.body.expires_in).toBe("7 days");
      portalToken = res.body.portal_token;
    });

    it("should return 400 when client_id missing", async () => {
      const res = await request(app)
        .post("/portal/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/client_id/i);
    });

    it("should return 401 without auth token", async () => {
      const res = await request(app)
        .post("/portal/generate")
        .send({ client_id: clientId });

      expect(res.status).toBe(401);
    });

    it("should return 404 for client not belonging to advisor", async () => {
      const other = await request(app)
        .post("/auth/signup")
        .send({ email: "other-portal@test.com", password: "TestPass123!", company_name: "Other Portal Co" });

      const res = await request(app)
        .post("/portal/generate")
        .set("Authorization", `Bearer ${other.body.token}`)
        .send({ client_id: clientId });

      expect(res.status).toBe(404);
    });

    it("should include client_name in response", async () => {
      const res = await request(app)
        .post("/portal/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ client_id: clientId });

      expect(res.body.client_name).toBe("Portal Client");
    });
  });

  describe("GET /portal/scenarios", () => {
    it("should return client scenarios with valid portal token", async () => {
      const res = await request(app)
        .get(`/portal/scenarios?token=${portalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.client).toBeDefined();
      expect(res.body.client.name).toBe("Portal Client");
      expect(Array.isArray(res.body.scenarios)).toBe(true);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/portal/scenarios");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it("should return 401 with invalid token", async () => {
      const res = await request(app).get("/portal/scenarios?token=invalid-jwt");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it("should return 401 when non-portal token used", async () => {
      const res = await request(app)
        .get(`/portal/scenarios?token=${adminToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid portal token type/i);
    });

    it("should return client details in response", async () => {
      const res = await request(app)
        .get(`/portal/scenarios?token=${portalToken}`);

      expect(res.body.client.email).toBe("portal-client@test.com");
    });

    it("should return scenarios array even when empty", async () => {
      const res = await request(app)
        .get(`/portal/scenarios?token=${portalToken}`);

      expect(Array.isArray(res.body.scenarios)).toBe(true);
    });
  });
});
