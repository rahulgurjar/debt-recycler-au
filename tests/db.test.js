const { pool, saveScenario, getScenario, getScenarios, deleteScenario, createUser, getUserByEmail, updateUserPassword } = require('../src/db');

describe('Database Schema & Operations', () => {
  let testUserId;
  let testClientId;
  let testScenarioId;

  beforeAll(async () => {
    try {
      await pool.query('BEGIN');
    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  afterAll(async () => {
    try {
      await pool.query('ROLLBACK');
      await pool.end();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Users Table', () => {
    it('should create a user with email, password hash, company, and role', async () => {
      const user = await createUser(
        'test@example.com',
        '$2b$10$hashedpassword123',
        'Test Company',
        'admin'
      );

      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
      expect(user.company_name).toBe('Test Company');
      expect(user.role).toBe('admin');
      testUserId = user.id;
    });

    it('should enforce unique email constraint', async () => {
      await expect(
        createUser(
          'test@example.com',
          '$2b$10$hashedpassword123',
          'Company'
        )
      ).rejects.toThrow();
    });

    it('should retrieve user by email', async () => {
      const user = await getUserByEmail('test@example.com');

      expect(user).not.toBeNull();
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).toBe('$2b$10$hashedpassword123');
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should update user password', async () => {
      const newHash = '$2b$10$newhashedpassword456';
      await updateUserPassword(testUserId, newHash);

      const user = await getUserByEmail('test@example.com');
      expect(user.password_hash).toBe(newHash);
    });

    it('should have created_at and updated_at timestamps', async () => {
      const user = await getUserByEmail('test@example.com');

      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
      expect(new Date(user.created_at)).toBeInstanceOf(Date);
    });
  });

  describe('Scenarios Table', () => {
    it('should save a scenario with parameters and projection results', async () => {
      const params = {
        user_id: testUserId,
        initial_outlay: 55000,
        gearing_ratio: 0.45,
        initial_loan: 45000,
        annual_investment: 25000,
        inflation: 0.03,
        loc_interest_rate: 0.07,
        etf_dividend_rate: 0.03,
        etf_capital_appreciation: 0.07,
        marginal_tax: 0.47,
      };

      const projectionResults = {
        final_wealth: 1250000,
        xirr: 0.1267,
        years: [
          {
            year: 1,
            date: '2024-07-01',
            pf_value: 75000,
            loan: 40000,
            wealth: 35000,
            dividend: 2250,
            loc_interest: 2800,
            taxable_dividend: 2250,
            after_tax_dividend: 1193,
            pf_value_30_june: 77000,
            wealth_30_june: 37000,
            gearing: 0.45,
          },
        ],
      };

      const scenario = await saveScenario('Test Scenario', params, projectionResults);

      expect(scenario).toHaveProperty('id');
      expect(scenario.name).toBe('Test Scenario');
      expect(scenario.initial_outlay).toBe(55000);
      testScenarioId = scenario.id;
    });

    it('should retrieve scenario by ID with full projections', async () => {
      const scenario = await getScenario(testScenarioId);

      expect(scenario).not.toBeNull();
      expect(scenario.name).toBe('Test Scenario');
      expect(scenario.final_wealth).toBe(1250000);
      expect(scenario.xirr).toBeCloseTo(0.1267, 4);
      expect(scenario.projections).toBeDefined();
      expect(scenario.projections.length).toBeGreaterThan(0);
    });

    it('should retrieve all scenarios for a user', async () => {
      const scenarios = await getScenarios(testUserId);

      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0].name).toBe('Test Scenario');
    });

    it('should have created_at and updated_at timestamps on scenarios', async () => {
      const scenario = await getScenario(testScenarioId);

      expect(scenario.created_at).toBeDefined();
      expect(scenario.updated_at).toBeDefined();
      expect(new Date(scenario.created_at)).toBeInstanceOf(Date);
    });

    it('should delete scenario (cascade delete projections)', async () => {
      const deleted = await deleteScenario(testScenarioId);

      expect(deleted).toBe(true);

      const scenario = await getScenario(testScenarioId);
      expect(scenario).toBeNull();
    });

    it('should return false when deleting non-existent scenario', async () => {
      const deleted = await deleteScenario(999999);
      expect(deleted).toBe(false);
    });
  });

  describe('Projections Table', () => {
    it('should store 20-year projection data', async () => {
      const params = {
        user_id: testUserId,
        initial_outlay: 55000,
        gearing_ratio: 0.45,
        initial_loan: 45000,
        annual_investment: 25000,
        inflation: 0.03,
        loc_interest_rate: 0.07,
        etf_dividend_rate: 0.03,
        etf_capital_appreciation: 0.07,
        marginal_tax: 0.47,
      };

      const projectionResults = {
        final_wealth: 1250000,
        xirr: 0.1267,
        years: Array.from({ length: 20 }, (_, i) => ({
          year: i + 1,
          date: `202${4 + Math.floor(i / 10)}-07-01`,
          pf_value: 75000 + i * 50000,
          loan: 40000 - i * 1000,
          wealth: 35000 + i * 51000,
          dividend: 2250 + i * 150,
          loc_interest: 2800 - i * 100,
          taxable_dividend: 2250,
          after_tax_dividend: 1193,
          pf_value_30_june: 77000 + i * 50000,
          wealth_30_june: 37000 + i * 51000,
          gearing: 0.45 - i * 0.01,
        })),
      };

      const scenario = await saveScenario('20-Year Scenario', params, projectionResults);
      const retrieved = await getScenario(scenario.id);

      expect(retrieved.projections.length).toBe(20);
      expect(retrieved.projections[0].year).toBe(1);
      expect(retrieved.projections[19].year).toBe(20);
      expect(retrieved.projections[0].pf_value).toBe(75000);
      expect(retrieved.projections[19].pf_value).toBe(1025000);
    });
  });

  describe('Indexes & Performance', () => {
    it('should have index on users.email', async () => {
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'users' AND indexname = 'idx_users_email'`
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on scenarios.user_id', async () => {
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'scenarios' AND indexname = 'idx_scenarios_user'`
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on projections.scenario_id', async () => {
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'projections' AND indexname = 'idx_projections_scenario'`
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should not allow NULL in required fields', async () => {
      await expect(
        createUser(null, 'password', 'Company')
      ).rejects.toThrow();
    });

    it('should cascade delete projections when scenario deleted', async () => {
      const params = {
        user_id: testUserId,
        initial_outlay: 55000,
        gearing_ratio: 0.45,
        initial_loan: 45000,
        annual_investment: 25000,
        inflation: 0.03,
        loc_interest_rate: 0.07,
        etf_dividend_rate: 0.03,
        etf_capital_appreciation: 0.07,
        marginal_tax: 0.47,
      };

      const projectionResults = {
        final_wealth: 1250000,
        xirr: 0.1267,
        years: [
          {
            year: 1,
            date: '2024-07-01',
            pf_value: 75000,
            loan: 40000,
            wealth: 35000,
          },
        ],
      };

      const scenario = await saveScenario('Cascade Test', params, projectionResults);
      const projectionsBefore = await pool.query(
        'SELECT * FROM projections WHERE scenario_id = $1',
        [scenario.id]
      );
      expect(projectionsBefore.rows.length).toBeGreaterThan(0);

      await deleteScenario(scenario.id);

      const projectionsAfter = await pool.query(
        'SELECT * FROM projections WHERE scenario_id = $1',
        [scenario.id]
      );
      expect(projectionsAfter.rows.length).toBe(0);
    });
  });
});
