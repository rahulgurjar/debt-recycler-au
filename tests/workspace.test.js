const request = require('supertest');
const app = require('../src/api');

describe('Workspace Management API', () => {
  let adminToken;
  let advisorToken;
  let adminId;
  let advisorId;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/auth/signup')
      .send({
        email: 'admin@company.com',
        password: 'AdminPass123!',
        company_name: 'Test Company',
      });
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;

    const advisorRes = await request(app)
      .post('/auth/signup')
      .send({
        email: 'advisor@company.com',
        password: 'AdvisorPass123!',
        company_name: 'Test Company',
      });
    advisorToken = advisorRes.body.token;
    advisorId = advisorRes.body.user.id;
  });

  describe('GET /workspace', () => {
    it('should retrieve workspace details for authenticated user', async () => {
      const res = await request(app)
        .get('/workspace')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('company_name');
      expect(res.body).toHaveProperty('subscription_tier');
      expect(res.body).toHaveProperty('team_members');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .get('/workspace');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /workspace/users', () => {
    it('should allow admin to invite team member', async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newadvisor@company.com',
          role: 'advisor',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('newadvisor@company.com');
      expect(res.body.user.role).toBe('advisor');
      expect(res.body).toHaveProperty('temporary_password');
    });

    it('should prevent advisor from inviting users', async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          email: 'another@company.com',
          role: 'advisor',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject duplicate email in workspace', async () => {
      await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'duplicate@company.com',
          role: 'advisor',
        });

      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'duplicate@company.com',
          role: 'advisor',
        });

      expect(res.status).toBe(409);
    });

    it('should require email and role', async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'test@company.com',
        });

      expect(res.status).toBe(400);
    });

    it('should assign invited user to same company as admin', async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'samecompany@company.com',
          role: 'advisor',
        });

      expect(res.status).toBe(201);

      const workspaceRes = await request(app)
        .get('/workspace')
        .set('Authorization', `Bearer ${adminToken}`);

      const member = workspaceRes.body.team_members.find(
        (m) => m.email === 'samecompany@company.com'
      );
      expect(member).toBeDefined();
    });

    it('should enforce invite rate limit of 10 per day', async () => {
      const rlAdminRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'ratelimitadmin@rlcompany.com',
          password: 'RLAdminPass123!',
          company_name: 'RL Company',
        });
      const rlAdminToken = rlAdminRes.body.token;

      let lastRes;
      for (let i = 0; i < 12; i++) {
        lastRes = await request(app)
          .post('/workspace/users')
          .set('Authorization', `Bearer ${rlAdminToken}`)
          .send({
            email: `ratelimit${i}@rlcompany.com`,
            role: 'advisor',
          });
      }
      expect(lastRes.status).toBe(429);
      expect(lastRes.body.error).toMatch(/limit/i);
    });
  });

  describe('PATCH /workspace/users/:userId', () => {
    let teamMemberId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'rolechange@company.com',
          role: 'advisor',
        });
      teamMemberId = res.body.user.id;
    });

    it('should allow admin to update user role', async () => {
      const res = await request(app)
        .patch(`/workspace/users/${teamMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'client',
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('client');
    });

    it('should prevent advisor from updating roles', async () => {
      const res = await request(app)
        .patch(`/workspace/users/${teamMemberId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          role: 'advisor',
        });

      expect(res.status).toBe(403);
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .patch(`/workspace/users/${teamMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'superuser',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /workspace/users/:userId', () => {
    let teamMemberId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/workspace/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'todelete@company.com',
          role: 'advisor',
        });
      teamMemberId = res.body.user.id;
    });

    it('should allow admin to remove team member', async () => {
      const res = await request(app)
        .delete(`/workspace/users/${teamMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should prevent removed user from accessing workspace', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'todelete@company.com',
          password: 'TempPass123',
        });

      expect(loginRes.status).toBe(401);
    });

    it('should prevent advisor from removing users', async () => {
      const res = await request(app)
        .delete(`/workspace/users/${adminId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/workspace/users/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /workspace/settings', () => {
    it('should retrieve workspace settings for admin', async () => {
      const res = await request(app)
        .get('/workspace/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('subscription_tier');
      expect(res.body).toHaveProperty('monthly_price');
      expect(res.body).toHaveProperty('max_clients');
    });

    it('should allow advisor to view settings (read-only)', async () => {
      const res = await request(app)
        .get('/workspace/settings')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject unauthenticated access', async () => {
      const res = await request(app)
        .get('/workspace/settings');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /workspace/settings', () => {
    it('should allow admin to update billing settings', async () => {
      const res = await request(app)
        .patch('/workspace/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subscription_tier: 'professional',
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription_tier).toBe('professional');
    });

    it('should prevent advisor from updating settings', async () => {
      const res = await request(app)
        .patch('/workspace/settings')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          subscription_tier: 'professional',
        });

      expect(res.status).toBe(403);
    });

    it('should validate tier options', async () => {
      const res = await request(app)
        .patch('/workspace/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subscription_tier: 'invalid_tier',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('RBAC Enforcement', () => {
    it('should enforce role-based access throughout', async () => {
      const endpoints = [
        { method: 'post', path: '/workspace/users', data: { email: 'test@co.com', role: 'advisor' } },
        { method: 'patch', path: '/workspace/users/1', data: { role: 'client' } },
        { method: 'delete', path: '/workspace/users/1', data: {} },
        { method: 'patch', path: '/workspace/settings', data: { subscription_tier: 'professional' } },
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${advisorToken}`)
          .send(endpoint.data);

        expect([403, 401]).toContain(res.status);
      }
    });
  });
});
