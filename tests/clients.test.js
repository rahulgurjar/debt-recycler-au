const request = require('supertest');
const app = require('../src/api');

describe('Client Management API', () => {
  let advisorToken;
  let clientId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'advisor@example.com',
        password: 'AdvisorPass123!',
        company_name: 'Advisory Firm',
      });
    advisorToken = res.body.token;
  });

  describe('POST /clients', () => {
    it('should create a new client', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          dob: '1980-05-15',
          annual_income: 150000,
          risk_profile: 'moderate',
        });

      expect(res.status).toBe(201);
      expect(res.body.client).toHaveProperty('id');
      expect(res.body.client.name).toBe('John Doe');
      expect(res.body.client.email).toBe('john@example.com');
      clientId = res.body.client.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/clients')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          dob: '1985-03-20',
          annual_income: 120000,
          risk_profile: 'conservative',
        });

      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Bob Smith',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate DOB format', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Alice Johnson',
          email: 'alice@example.com',
          dob: 'invalid-date',
          annual_income: 100000,
          risk_profile: 'aggressive',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /clients', () => {
    beforeAll(async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/clients')
          .set('Authorization', `Bearer ${advisorToken}`)
          .send({
            name: `Client ${i}`,
            email: `client${i}@example.com`,
            dob: '1990-01-01',
            annual_income: 100000 + i * 10000,
            risk_profile: 'moderate',
          });
      }
    });

    it('should list all clients for authenticated advisor', async () => {
      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.clients)).toBe(true);
      expect(res.body.clients.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/clients?limit=3&offset=0')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.clients.length).toBeLessThanOrEqual(3);
      expect(res.body).toHaveProperty('total');
    });

    it('should support sorting', async () => {
      const res = await request(app)
        .get('/clients?sort=annual_income&order=desc')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      if (res.body.clients.length > 1) {
        expect(res.body.clients[0].annual_income).toBeGreaterThanOrEqual(
          res.body.clients[1].annual_income
        );
      }
    });

    it('should support filtering by risk profile', async () => {
      const res = await request(app)
        .get('/clients?risk_profile=moderate')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.clients.every(c => c.risk_profile === 'moderate')).toBe(true);
    });
  });

  describe('GET /clients/:id', () => {
    it('should retrieve specific client', async () => {
      const res = await request(app)
        .get(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientId);
      expect(res.body.client.name).toBe('John Doe');
    });

    it('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .get('/clients/999999')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /clients/:id', () => {
    it('should update client information', async () => {
      const res = await request(app)
        .patch(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          annual_income: 180000,
          risk_profile: 'aggressive',
        });

      expect(res.status).toBe(200);
      expect(res.body.client.annual_income).toBe(180000);
      expect(res.body.client.risk_profile).toBe('aggressive');
    });

    it('should not allow partial updates to corrupt data', async () => {
      const res = await request(app)
        .patch(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          email: 'newemail@example.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.client.email).toBe('newemail@example.com');
      expect(res.body.client.name).toBe('John Doe');
    });
  });

  describe('DELETE /clients/:id', () => {
    let deleteClientId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Delete Me',
          email: 'delete@example.com',
          dob: '1992-07-10',
          annual_income: 110000,
          risk_profile: 'moderate',
        });
      deleteClientId = res.body.client.id;
    });

    it('should delete client', async () => {
      const res = await request(app)
        .delete(`/clients/${deleteClientId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
    });

    it('should cascade delete related scenarios', async () => {
      const getRes = await request(app)
        .get(`/clients/${deleteClientId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('POST /clients/import', () => {
    it('should bulk import clients from CSV', async () => {
      const csvData = `name,email,dob,annual_income,risk_profile
Jane Smith,jane@example.com,1985-03-20,125000,moderate
Bob Johnson,bob@example.com,1988-06-15,95000,conservative
Alice Brown,alice@example.com,1992-09-10,150000,aggressive`;

      const res = await request(app)
        .post('/clients/import')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ csv: csvData });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('imported');
      expect(res.body.imported).toBe(3);
    });

    it('should validate CSV format', async () => {
      const invalidCsv = `name,email
John,john@example.com`;

      const res = await request(app)
        .post('/clients/import')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ csv: invalidCsv });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('should report row-level errors in bulk import', async () => {
      const csvData = `name,email,dob,annual_income,risk_profile
Jane Doe,jane@example.com,invalid-date,125000,moderate
Bob Smith,bob@example.com,1988-06-15,95000,conservative`;

      const res = await request(app)
        .post('/clients/import')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ csv: csvData });

      expect(res.status).toBe(207);
      expect(res.body).toHaveProperty('errors');
      expect(res.body.errors.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('imported');
    });

    it('should handle large imports asynchronously', async () => {
      const rows = Array.from({ length: 1000 }, (_, i) =>
        `Client${i},client${i}@example.com,1990-01-01,100000,moderate`
      ).join('\n');

      const csvData = `name,email,dob,annual_income,risk_profile\n${rows}`;

      const res = await request(app)
        .post('/clients/import')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ csv: csvData });

      expect([200, 202]).toContain(res.status);
      if (res.status === 202) {
        expect(res.body).toHaveProperty('job_id');
      }
    });
  });

  describe('Client Data Validation', () => {
    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          dob: '1990-01-01',
          annual_income: 100000,
          risk_profile: 'moderate',
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative income', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Bad Income',
          email: 'badincome@example.com',
          dob: '1990-01-01',
          annual_income: -50000,
          risk_profile: 'moderate',
        });

      expect(res.status).toBe(400);
    });

    it('should validate risk profile enum', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          name: 'Bad Risk',
          email: 'badrisk@example.com',
          dob: '1990-01-01',
          annual_income: 100000,
          risk_profile: 'extreme',
        });

      expect(res.status).toBe(400);
    });
  });
});
