const request = require("supertest");
const app = require("../src/api.js");

describe("Authentication API", () => {
  const testUser = {
    email: "advisor@example.com",
    password: "SecurePass123!",
    company_name: "Test Advisory",
  };

  describe("POST /auth/signup", () => {
    it("should create a new user account", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user).not.toHaveProperty("password");
    });

    it("should reject duplicate email", async () => {
      await request(app)
        .post("/auth/signup")
        .send(testUser);

      const res = await request(app)
        .post("/auth/signup")
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject invalid email format", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          ...testUser,
          email: "not-an-email",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject weak password", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          ...testUser,
          password: "weak",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should require email and password", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ company_name: "Test" });

      expect(res.status).toBe(400);
    });

    it("should hash password (not stored in plain text)", async () => {
      await request(app)
        .post("/auth/signup")
        .send(testUser);

      const res = await request(app)
        .get("/auth/debug/user")
        .query({ email: testUser.email });

      expect(res.body.password_hash).not.toBe(testUser.password);
      expect(res.body.password_hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app)
        .post("/auth/signup")
        .send(testUser);
    });

    it("should return JWT token on successful login", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testUser.email);
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject non-existent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: testUser.password,
        });

      expect(res.status).toBe(401);
    });

    it("should require email and password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: testUser.email });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("should accept logout request", async () => {
      const loginRes = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      const res = await request(app)
        .post("/auth/logout")
        .set("Authorization", `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("JWT Token Validation", () => {
    let validToken;

    beforeEach(async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      validToken = res.body.token;
    });

    it("should validate valid JWT token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testUser.email);
    });

    it("should reject missing Authorization header", async () => {
      const res = await request(app)
        .get("/auth/me");

      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
    });

    it("should reject expired token", async () => {
      const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjB9.XOUpPTVHVjL0eFSIJgfAWjKRQ2c7JdQ0E2CxN6H5eXg";
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("should not log JWT tokens in error messages", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}invalid`);

      expect(res.text).not.toContain(validToken);
      expect(res.body.error).not.toContain("Bearer");
    });
  });

  describe("Password Reset Flow", () => {
    beforeEach(async () => {
      await request(app)
        .post("/auth/signup")
        .send(testUser);
    });

    it("should initiate password reset and send email", async () => {
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
    });

    it("should accept password reset token and update password", async () => {
      const resetRes = await request(app)
        .post("/auth/forgot-password")
        .send({ email: testUser.email });

      const resetToken = resetRes.body.reset_token;

      const newPassword = "NewSecurePass456!";
      const res = await request(app)
        .post("/auth/reset-password")
        .send({
          reset_token: resetToken,
          new_password: newPassword,
        });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: newPassword,
        });

      expect(loginRes.status).toBe(200);
    });

    it("should reject invalid reset token", async () => {
      const res = await request(app)
        .post("/auth/reset-password")
        .send({
          reset_token: "invalid_token_123",
          new_password: "NewPassword123!",
        });

      expect(res.status).toBe(400);
    });

    it("should expire reset token after 1 hour", async () => {
      const resetRes = await request(app)
        .post("/auth/forgot-password")
        .send({ email: testUser.email });

      const resetToken = resetRes.body.reset_token;

      await new Promise(resolve => setTimeout(resolve, 3600100));

      const res = await request(app)
        .post("/auth/reset-password")
        .send({
          reset_token: resetToken,
          new_password: "NewPassword123!",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("Role-Based Access Control", () => {
    let adminUser;
    let advisorUser;
    let adminToken;
    let advisorToken;

    beforeEach(async () => {
      adminUser = { email: "admin@company.com", password: "Admin123!", company_name: "Company" };
      advisorUser = { email: "advisor@company.com", password: "Advisor123!", company_name: "Company" };

      const adminRes = await request(app)
        .post("/auth/signup")
        .send(adminUser);
      adminToken = adminRes.body.token;

      const advisorRes = await request(app)
        .post("/auth/signup")
        .send(advisorUser);
      advisorToken = advisorRes.body.token;
    });

    it("should allow admin to create users", async () => {
      const res = await request(app)
        .post("/workspace/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "newadvisor@company.com",
          role: "advisor",
        });

      expect(res.status).toBe(201);
    });

    it("should deny advisor from creating users", async () => {
      const res = await request(app)
        .post("/workspace/users")
        .set("Authorization", `Bearer ${advisorToken}`)
        .send({
          email: "newadvisor@company.com",
          role: "advisor",
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
    });

    it("should restrict workspace settings to admin only", async () => {
      const res = await request(app)
        .patch("/workspace/settings")
        .set("Authorization", `Bearer ${advisorToken}`)
        .send({ subscription_tier: "enterprise" });

      expect(res.status).toBe(403);
    });
  });
});
