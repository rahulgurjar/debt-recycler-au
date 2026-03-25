const request = require('supertest');
const app = require('../src/api');

describe('PDF Report Generation', () => {
  let advisorToken;
  let clientId;
  let scenarioId;

  beforeAll(async () => {
    const userRes = await request(app)
      .post('/auth/signup')
      .send({
        email: 'advisor@example.com',
        password: 'AdvisorPass123!',
        company_name: 'Advisory Firm',
      });
    advisorToken = userRes.body.token;

    const clientRes = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        name: 'John Smith',
        email: 'john@example.com',
        dob: '1975-06-20',
        annual_income: 200000,
        risk_profile: 'high',
      });
    clientId = clientRes.body.client.id;

    const scenarioRes = await request(app)
      .post('/scenarios')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        client_id: clientId,
        name: 'Aggressive Growth Strategy',
        initial_outlay: 55000,
        gearing_ratio: 0.45,
        initial_loan: 45000,
        annual_investment: 25000,
        inflation: 0.03,
        loc_interest_rate: 0.07,
        etf_dividend_rate: 0.03,
        etf_capital_appreciation: 0.07,
        marginal_tax: 0.47,
      });
    scenarioId = scenarioRes.body.scenario.id;
  });

  describe('POST /scenarios/:id/report', () => {
    it('should generate PDF report for a scenario', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('report_id');
      expect(res.body).toHaveProperty('filename');
      expect(res.body).toHaveProperty('s3_url');
      expect(res.body.filename).toMatch(/\.pdf$/);
    });

    it('should include client name in PDF', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metadata');
      expect(res.body.metadata.client_name).toBe('John Smith');
    });

    it('should include scenario name in PDF', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata.scenario_name).toBe('Aggressive Growth Strategy');
    });

    it('should include generation date in PDF', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('generated_date');
      expect(new Date(res.body.metadata.generated_date)).toBeInstanceOf(Date);
    });

    it('should include strategy summary in report', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('strategy_summary');
      expect(res.body.metadata.strategy_summary).toHaveProperty('initial_outlay');
      expect(res.body.metadata.strategy_summary).toHaveProperty('loan_amount');
      expect(res.body.metadata.strategy_summary).toHaveProperty('annual_investment');
    });

    it('should include projection data in report', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('projection_summary');
      expect(res.body.metadata.projection_summary).toHaveProperty('final_wealth');
      expect(res.body.metadata.projection_summary).toHaveProperty('total_tax');
      expect(res.body.metadata.projection_summary).toHaveProperty('xirr');
    });

    it('should include disclaimer in report', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('includes_disclaimer');
      expect(res.body.metadata.includes_disclaimer).toBe(true);
    });

    it('should return 404 for non-existent scenario', async () => {
      const res = await request(app)
        .post('/scenarios/999999/report')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(404);
    });

    it('should enforce client ownership verification', async () => {
      const otherUserRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'other@example.com',
          password: 'OtherPass123!',
        });
      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send();

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .send();

      expect(res.status).toBe(401);
    });

    it('should generate unique filenames for multiple reports', async () => {
      const res1 = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      const res2 = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res1.body.filename).not.toBe(res2.body.filename);
    });

    it('should support custom title option', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          title: 'Custom Report Title',
        });

      expect(res.status).toBe(200);
      expect(res.body.metadata.title).toBe('Custom Report Title');
    });

    it('should support custom company branding', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          include_company_branding: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('company_name');
      expect(res.body.metadata.company_name).toBe('Advisory Firm');
    });
  });

  describe('Report Storage', () => {
    it('should store report in S3', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.s3_url).toMatch(/^https:\/\//);
      expect(res.body.s3_url).toMatch(/\.pdf$/);
    });

    it('should return valid S3 URL', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.s3_url).toBeDefined();
      expect(res.body.s3_url.length).toBeGreaterThan(0);
    });

    it('should store report metadata in database', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('report_id');
      expect(typeof res.body.report_id).toBe('number');
    });
  });

  describe('Report Content', () => {
    it('should include all scenario parameters', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata.strategy_summary).toHaveProperty('initial_outlay', 55000);
      expect(res.body.metadata.strategy_summary).toHaveProperty('gearing_ratio', 0.45);
      expect(res.body.metadata.strategy_summary).toHaveProperty('annual_investment', 25000);
    });

    it('should include 20-year projection summary', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata.projection_summary).toHaveProperty('final_wealth');
      expect(res.body.metadata.projection_summary).toHaveProperty('total_tax');
      expect(res.body.metadata.projection_summary).toHaveProperty('total_investment');
      expect(res.body.metadata.projection_summary).toHaveProperty('xirr');
    });

    it('should include tax implications', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('tax_summary');
      expect(res.body.metadata.tax_summary).toHaveProperty('total_tax');
      expect(res.body.metadata.tax_summary).toHaveProperty('marginal_tax_rate');
    });

    it('should include disclaimer statement', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.metadata).toHaveProperty('disclaimer_text');
      expect(res.body.metadata.disclaimer_text).toMatch(/not.*financial advice/i);
    });

    it('should not include debug data in report', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();

      expect(res.status).toBe(200);
      const debugPatterns = ['debug', 'test', 'tmp', 'internal'];
      debugPatterns.forEach(pattern => {
        if (res.body.metadata.disclaimer_text) {
          expect(res.body.metadata.disclaimer_text.toLowerCase()).not.toMatch(new RegExp(pattern));
        }
      });
    });
  });

  describe('Report Performance', () => {
    it('should generate report in under 2 seconds', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/report`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send();
      const duration = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });
  });
});
