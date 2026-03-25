const request = require('supertest');
const app = require('../src/api');

describe('Scenario Versioning & Audit Trail', () => {
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

    const scenarioRes = await request(app)
      .post('/scenarios')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        client_id: clientId,
        name: 'Initial Scenario',
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

  describe('POST /scenarios/:id/versions', () => {
    it('should create initial version when scenario is created', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.versions)).toBe(true);
      expect(res.body.versions.length).toBeGreaterThan(0);
      expect(res.body.versions[0]).toHaveProperty('id');
      expect(res.body.versions[0]).toHaveProperty('scenario_id');
      expect(res.body.versions[0]).toHaveProperty('parameters');
      expect(res.body.versions[0]).toHaveProperty('created_by');
      expect(res.body.versions[0]).toHaveProperty('created_at');
    });

    it('should create new version on scenario update', async () => {
      const initialVersionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const initialCount = initialVersionsRes.body.versions.length;

      await request(app)
        .patch(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          initial_outlay: 75000,
        });

      const updatedVersionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(updatedVersionsRes.status).toBe(200);
      expect(updatedVersionsRes.body.versions.length).toBe(initialCount + 1);
    });

    it('should preserve all parameters in version snapshot', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      const latestVersion = res.body.versions[res.body.versions.length - 1];
      expect(latestVersion.parameters).toHaveProperty('initial_outlay');
      expect(latestVersion.parameters).toHaveProperty('gearing_ratio');
      expect(latestVersion.parameters).toHaveProperty('initial_loan');
      expect(latestVersion.parameters).toHaveProperty('annual_investment');
      expect(latestVersion.parameters).toHaveProperty('inflation');
      expect(latestVersion.parameters).toHaveProperty('loc_interest_rate');
      expect(latestVersion.parameters).toHaveProperty('etf_dividend_rate');
      expect(latestVersion.parameters).toHaveProperty('etf_capital_appreciation');
      expect(latestVersion.parameters).toHaveProperty('marginal_tax');
    });
  });

  describe('GET /scenarios/:id/versions', () => {
    it('should list all versions for a scenario', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.versions)).toBe(true);
      expect(res.body.versions.length).toBeGreaterThan(0);
    });

    it('should support pagination for versions', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions?limit=1&offset=0`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.versions.length).toBeLessThanOrEqual(1);
    });

    it('should return versions in reverse chronological order', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      if (res.body.versions.length > 1) {
        const first = new Date(res.body.versions[0].created_at).getTime();
        const second = new Date(res.body.versions[1].created_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should return 404 for non-existent scenario', async () => {
      const res = await request(app)
        .get('/scenarios/999999/versions')
        .set('Authorization', `Bearer ${advisorToken}`);

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
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /scenarios/:id/versions/:versionId', () => {
    let versionId;

    beforeAll(async () => {
      const versionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      versionId = versionsRes.body.versions[0].id;
    });

    it('should retrieve specific version', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/${versionId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.version.id).toBe(versionId);
      expect(res.body.version).toHaveProperty('parameters');
      expect(res.body.version).toHaveProperty('created_by');
      expect(res.body.version).toHaveProperty('created_at');
    });

    it('should return 404 for non-existent version', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/999999`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(404);
    });

    it('should enforce client ownership verification', async () => {
      const otherUserRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'other2@example.com',
          password: 'OtherPass123!',
        });
      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/${versionId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /scenarios/:id/versions/compare', () => {
    let version1Id;
    let version2Id;

    beforeAll(async () => {
      const versionsRes1 = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      version1Id = versionsRes1.body.versions[versionsRes1.body.versions.length - 1].id;

      await request(app)
        .patch(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({
          loc_interest_rate: 0.09,
          annual_investment: 30000,
        });

      const versionsRes2 = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      version2Id = versionsRes2.body.versions[versionsRes2.body.versions.length - 1].id;
    });

    it('should compare two versions', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/compare?from=${version1Id}&to=${version2Id}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('changes');
      expect(Array.isArray(res.body.changes)).toBe(true);
    });

    it('should show all differences between versions', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/compare?from=${version1Id}&to=${version2Id}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      const changes = res.body.changes;
      expect(changes.some(c => c.field === 'loc_interest_rate')).toBe(true);
      expect(changes.some(c => c.field === 'annual_investment')).toBe(true);
    });

    it('should include old and new values in comparison', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/compare?from=${version1Id}&to=${version2Id}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      const changes = res.body.changes;
      changes.forEach(change => {
        expect(change).toHaveProperty('field');
        expect(change).toHaveProperty('old_value');
        expect(change).toHaveProperty('new_value');
      });
    });

    it('should require both from and to parameters', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/compare?from=${version1Id}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(400);
    });

    it('should enforce client ownership verification', async () => {
      const otherUserRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'other3@example.com',
          password: 'OtherPass123!',
        });
      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions/compare?from=${version1Id}&to=${version2Id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /scenarios/:id/versions/:versionId/restore', () => {
    let targetVersionId;

    beforeAll(async () => {
      const versionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      targetVersionId = versionsRes.body.versions[versionsRes.body.versions.length - 1].id;
    });

    it('should restore scenario to previous version', async () => {
      const targetVersionRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions/${targetVersionId}`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const targetParams = targetVersionRes.body.version.parameters;

      const res = await request(app)
        .post(`/scenarios/${scenarioId}/versions/${targetVersionId}/restore`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scenario).toHaveProperty('id');
    });

    it('should update scenario parameters to restored version', async () => {
      const targetVersionRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions/${targetVersionId}`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const targetParams = targetVersionRes.body.version.parameters;

      await request(app)
        .post(`/scenarios/${scenarioId}/versions/${targetVersionId}/restore`)
        .set('Authorization', `Bearer ${advisorToken}`);

      const scenarioRes = await request(app)
        .get(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(scenarioRes.body.scenario.initial_outlay).toBe(targetParams.initial_outlay);
      expect(scenarioRes.body.scenario.loc_interest_rate).toBe(targetParams.loc_interest_rate);
    });

    it('should create new version for restoration action', async () => {
      const versionsBeforeRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const countBefore = versionsBeforeRes.body.versions.length;

      await request(app)
        .post(`/scenarios/${scenarioId}/versions/${targetVersionId}/restore`)
        .set('Authorization', `Bearer ${advisorToken}`);

      const versionsAfterRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(versionsAfterRes.body.versions.length).toBeGreaterThan(countBefore);
    });

    it('should return 404 for non-existent version to restore', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/versions/999999/restore`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(404);
    });

    it('should enforce client ownership verification', async () => {
      const otherUserRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'other4@example.com',
          password: 'OtherPass123!',
        });
      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .post(`/scenarios/${scenarioId}/versions/${targetVersionId}/restore`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('should restore with correct timestamp', async () => {
      const res = await request(app)
        .post(`/scenarios/${scenarioId}/versions/${targetVersionId}/restore`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scenario).toHaveProperty('updated_at');
    });
  });

  describe('Audit Trail', () => {
    it('should capture user id in version creation', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      res.body.versions.forEach(version => {
        expect(version.created_by).toBeDefined();
      });
    });

    it('should record creation timestamp for each version', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      res.body.versions.forEach(version => {
        expect(version.created_at).toBeDefined();
        expect(new Date(version.created_at)).toBeInstanceOf(Date);
      });
    });

    it('should allow filtering versions by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions?from_date=${yesterday}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.versions)).toBe(true);
    });

    it('should include version count in scenario GET response', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scenario).toHaveProperty('version_count');
    });
  });

  describe('Version Constraints', () => {
    it('should not allow deleting versions', async () => {
      const versionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const versionId = versionsRes.body.versions[0].id;

      const res = await request(app)
        .delete(`/scenarios/${scenarioId}/versions/${versionId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(405);
    });

    it('should not allow modifying version snapshots', async () => {
      const versionsRes = await request(app)
        .get(`/scenarios/${scenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);
      const versionId = versionsRes.body.versions[0].id;

      const res = await request(app)
        .patch(`/scenarios/${scenarioId}/versions/${versionId}`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ parameters: { initial_outlay: 999999 } });

      expect(res.status).toBe(405);
    });

    it('should require authentication to access versions', async () => {
      const res = await request(app)
        .get(`/scenarios/${scenarioId}/versions`);

      expect(res.status).toBe(401);
    });

    it('should cascade delete versions when scenario is deleted', async () => {
      const newScenarioRes = await request(app)
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
      const deleteScenarioId = newScenarioRes.body.scenario.id;

      await request(app)
        .delete(`/scenarios/${deleteScenarioId}`)
        .set('Authorization', `Bearer ${advisorToken}`);

      const res = await request(app)
        .get(`/scenarios/${deleteScenarioId}/versions`)
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(404);
    });
  });
});
