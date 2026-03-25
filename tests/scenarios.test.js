const request = require('supertest');
const app = require('../src/api');

describe('Scenario Management & Calculation API', () => {
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
        name: 'Test Client',
        email: 'client@example.com',
        dob: '1980-05-15',
        annual_income: 150000,
        risk_profile: 'moderate',
      });
    clientId = clientRes.body.client.id;
  });

  describe('POST /scenarios', () => {
    it('should create a scenario with debt recycling parameters', async () => {
      const res = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Base Case Projection',
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

      expect(res.status).toBe(201);
      expect(res.body.scenario).toHaveProperty('id');
      expect(res.body.scenario.name).toBe('Base Case Projection');
      expect(res.body.projection).toBeDefined();
      expect(res.body.projection.years).toBeDefined();
      expect(res.body.projection.years.length).toBe(20);
      scenarioId = res.body.scenario.id;
    });

    it('should calculate correct projection data', async () => {
      const res = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Test Calculation',
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

      expect(res.status).toBe(201);
      const projection = res.body.projection;

      expect(projection.final_wealth).toBeGreaterThan(0);
      expect(projection.xirr).toBeGreaterThan(0.10);
      expect(projection.xirr).toBeLessThan(0.15);

      const firstYear = projection.years[0];
      expect(firstYear.year).toBe(1);
      expect(firstYear.pf_value).toBeGreaterThan(0);
      expect(firstYear.loan).toBeGreaterThan(0);
      expect(firstYear.wealth).toBeGreaterThan(0);

      const lastYear = projection.years[19];
      expect(lastYear.year).toBe(20);
      expect(lastYear.wealth).toBeGreaterThan(firstYear.wealth);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/scenarios')
        .send({
          client_id: clientId,
          name: 'Unauthorized',
          initial_outlay: 55000,
        });

      expect(res.status).toBe(401);
    });

    it('should validate client ownership', async () => {
      const otherUserRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'other@example.com',
          password: 'OtherPass123!',
        });
      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          client_id: clientId,
          name: 'Wrong Client',
          initial_outlay: 55000,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /scenarios/:id', () => {
    it('should retrieve scenario with full projection', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scenario.id).toBe(scenarioId);
      expect(res.body.scenario.name).toBe('Base Case Projection');
      expect(res.body.scenario.projections).toBeDefined();
      expect(res.body.scenario.projections.length).toBe(20);
    });

    it('should return 404 for non-existent scenario', async () => {
      const res = await request(app)
        .get('/scenarios/999999')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /clients/:id/scenarios', () => {
    it('should list all scenarios for a client', async () => {
      const res = await request(app)
        .get(`/clients/${clientId}/scenarios`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.scenarios)).toBe(true);
      expect(res.body.scenarios.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get(`/clients/${clientId}/scenarios?limit=1&offset=0`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scenarios.length).toBeLessThanOrEqual(1);
    });
  });

  describe('PATCH /scenarios/:id', () => {
    it('should update scenario parameters and recalculate', async () => {
      const res = await request(app)
        .patch(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          initial_outlay: 75000,
          gearing_ratio: 0.50,
        });

      expect(res.status).toBe(200);
      expect(res.body.scenario.initial_outlay).toBe(75000);
      expect(res.body.scenario.gearing_ratio).toBe(0.50);
      expect(res.body.projection).toBeDefined();
    });

    it('should validate parameter ranges', async () => {
      const res = await request(app)
        .patch(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          gearing_ratio: 1.5,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /scenarios/:id', () => {
    let deleteScenarioId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'To Delete',
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
      deleteScenarioId = res.body.scenario.id;
    });

    it('should delete scenario', async () => {
      const res = await request(app)
        .delete(`/scenarios/${deleteScenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
    });

    it('should cascade delete projections', async () => {
      const getRes = await request(app)
        .get(`/scenarios/${deleteScenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('Sensitivity Analysis', () => {
    it('should support parameter variation for sensitivity analysis', async () => {
      const baseRes = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Base Case',
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

      const higherRateRes = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Higher Interest Rate',
          initial_outlay: 55000,
          gearing_ratio: 0.45,
          initial_loan: 45000,
          annual_investment: 25000,
          inflation: 0.03,
          loc_interest_rate: 0.09,
          etf_dividend_rate: 0.03,
          etf_capital_appreciation: 0.07,
          marginal_tax: 0.47,
        });

      const baseWealth = baseRes.body.projection.final_wealth;
      const higherRateWealth = higherRateRes.body.projection.final_wealth;

      expect(higherRateWealth).toBeLessThan(baseWealth);
    });

    it('should show impact of gearing ratio variation', async () => {
      const lowGearRes = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Low Gearing',
          initial_outlay: 55000,
          gearing_ratio: 0.30,
          initial_loan: 30000,
          annual_investment: 25000,
          inflation: 0.03,
          loc_interest_rate: 0.07,
          etf_dividend_rate: 0.03,
          etf_capital_appreciation: 0.07,
          marginal_tax: 0.47,
        });

      const highGearRes = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'High Gearing',
          initial_outlay: 55000,
          gearing_ratio: 0.60,
          initial_loan: 60000,
          annual_investment: 25000,
          inflation: 0.03,
          loc_interest_rate: 0.07,
          etf_dividend_rate: 0.03,
          etf_capital_appreciation: 0.07,
          marginal_tax: 0.47,
        });

      const lowGearXirr = lowGearRes.body.projection.xirr;
      const highGearXirr = highGearRes.body.projection.xirr;

      expect(highGearXirr).toBeGreaterThan(lowGearXirr);
    });
  });

  describe('Calculation Accuracy', () => {
    it('should match reference spreadsheet calculation', async () => {
      const res = await request(app)
        .post('/scenarios')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          client_id: clientId,
          name: 'Reference Test',
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

      const projection = res.body.projection;
      expect(projection.xirr).toBeCloseTo(0.1255, 3);
    });
  });
});
