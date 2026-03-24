const request = require('supertest');

// Mock the database module before importing app
jest.mock('../src/db', () => ({
  saveScenario: jest.fn(async (name, params, _projection) => ({
    id: 1,
    name,
    ...params,
  })),
  getScenarios: jest.fn(async () => [
    {
      id: 1,
      name: 'Test Scenario',
      final_wealth: 3349321.30,
      xirr: 0.1353,
    },
  ]),
  getScenario: jest.fn(async (_id) => ({
    id: 1,
    name: 'Test Scenario',
    projections: [],
  })),
  deleteScenario: jest.fn(async (_id) => true),
  healthCheck: jest.fn(async () => ({ connected: true })),
}));

const app = require('../src/api');

describe('Debt Recycling API', () => {
  describe('GET /health', () => {
    it('should return health check status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/calculate', () => {
    it('should calculate projection with default parameters', async () => {
      const res = await request(app)
        .post('/api/calculate')
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projection).toBeDefined();
      expect(res.body.projection.length).toBe(21);
      expect(res.body.final_wealth).toBeDefined();
      expect(res.body.xirr).toBeDefined();
      expect(res.body.parameters).toBeDefined();
    });

    it('should calculate projection with custom parameters', async () => {
      const res = await request(app)
        .post('/api/calculate')
        .send({
          initial_outlay: 100000,
          annual_investment: 50000,
          loc_interest_rate: 0.05,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.parameters.initial_outlay).toBe(100000);
      expect(res.body.parameters.annual_investment).toBe(50000);
      expect(res.body.parameters.loc_interest_rate).toBe(0.05);
    });

    it('should return 21 year records (Year 0 to Year 20)', () => {
      return request(app)
        .post('/api/calculate')
        .send({})
        .then(res => {
          expect(res.body.projection.length).toBe(21);
          expect(res.body.projection[0].year).toBe(0);
          expect(res.body.projection[20].year).toBe(20);
        });
    });
  });

  describe('POST /api/scenarios', () => {
    it('should save a scenario with default parameters', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .send({ name: 'Test Scenario' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scenario).toBeDefined();
      expect(res.body.projection).toBeDefined();
    });

    it('should require scenario name', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/scenarios', () => {
    it('should list all scenarios', async () => {
      const res = await request(app).get('/api/scenarios');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scenarios).toBeDefined();
      expect(Array.isArray(res.body.scenarios)).toBe(true);
    });
  });

  describe('GET /api/scenarios/:id', () => {
    it('should get a specific scenario', async () => {
      const res = await request(app).get('/api/scenarios/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scenario).toBeDefined();
    });
  });
});
