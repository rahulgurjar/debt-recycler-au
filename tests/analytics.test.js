const request = require('supertest');
const app = require('../src/api');

describe('Admin Analytics API', () => {
  let adminToken;
  let advisorToken;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/auth/signup')
      .send({ email: 'analytics-admin@co.com', password: 'AdminPass123!', company_name: 'Analytics Co' });
    adminToken = adminRes.body.token;

    const advisorRes = await request(app)
      .post('/auth/signup')
      .send({ email: 'analytics-advisor@co.com', password: 'AdvisorPass123!', company_name: 'Analytics Co' });
    advisorToken = advisorRes.body.token;
  });

  describe('GET /admin/analytics', () => {
    it('should return analytics data for admin', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_users');
      expect(res.body).toHaveProperty('signups_last_7_days');
      expect(res.body).toHaveProperty('signups_last_30_days');
      expect(res.body).toHaveProperty('tier_breakdown');
      expect(res.body).toHaveProperty('mrr');
      expect(res.body).toHaveProperty('arr');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/admin/analytics');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin user', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${advisorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return numeric total_users', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(typeof res.body.total_users).toBe('number');
      expect(res.body.total_users).toBeGreaterThanOrEqual(0);
    });

    it('should return tier_breakdown as object with known tiers', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      const tb = res.body.tier_breakdown;
      expect(typeof tb).toBe('object');
      expect(tb).toHaveProperty('starter');
      expect(tb).toHaveProperty('professional');
      expect(tb).toHaveProperty('enterprise');
    });

    it('should return mrr and arr as numbers', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(typeof res.body.mrr).toBe('number');
      expect(typeof res.body.arr).toBe('number');
      expect(res.body.arr).toBeCloseTo(res.body.mrr * 12, 0);
    });

    it('should return signups_last_7_days <= signups_last_30_days', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.signups_last_7_days).toBeLessThanOrEqual(res.body.signups_last_30_days);
    });

    it('should include top_customers array', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Array.isArray(res.body.top_customers)).toBe(true);
    });

    it('should respond in under 1 second', async () => {
      const start = Date.now();
      await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });
});
