const request = require('supertest');
const app = require('../src/api');

describe('Email Integration API', () => {
  let adminToken;
  let clientId;
  let scenarioId;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/auth/signup')
      .send({ email: 'email-admin@co.com', password: 'AdminPass123!', company_name: 'Email Co' });
    adminToken = adminRes.body.token;

    const clientRes = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ first_name: 'Jane', last_name: 'Doe', email: 'jane@client.com', risk_profile: 'moderate' });
    clientId = clientRes.body.id;

    const scenarioRes = await request(app)
      .post('/scenarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ client_id: clientId, name: 'Email Test Scenario' });
    scenarioId = scenarioRes.body.scenario?.id;
  });

  describe('POST /scenarios/:id/email', () => {
    it('should send email for valid scenario', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'jane@client.com' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('email_log_id');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .send({ recipient_email: 'jane@client.com' });

      expect(res.status).toBe(401);
    });

    it('should require recipient_email', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent scenario', async () => {
      const res = await request(app)
        .post('/scenarios/999999/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'jane@client.com' });

      expect(res.status).toBe(404);
    });

    it('should track email in email_logs', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'tracked@client.com' });

      expect(res.status).toBe(200);
      expect(res.body.email_log_id).toBeDefined();
    });

    it('should include subject in response', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'jane@client.com', subject: 'Your Strategy Report' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('subject');
    });

    it('should support scheduled sending', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipient_email: 'jane@client.com', scheduled_at: futureDate });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('scheduled_at');
    });
  });
});
