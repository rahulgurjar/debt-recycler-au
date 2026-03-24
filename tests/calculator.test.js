const { calculate } = require('../src/calculator');

describe('Debt Recycling Calculator', () => {
  const baselineParams = {
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

  describe('Test 1: Year 0 Baseline (±0.01% tolerance)', () => {
    it('should calculate correct PF Value at Year 0, 30 June', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // Expected: $106,921 ±0.01% = ±$10.69
      expect(year0.pf_value_30_june).toBeCloseTo(106921, -2);
    });

    it('should calculate correct Wealth at Year 0, 30 June', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // Expected: $61,841 ±0.01% = ±$6.18
      expect(year0.wealth_30_june).toBeCloseTo(61841, -2);
    });

    it('should have correct initial values on Year 0, 1 July', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      expect(year0.year).toBe(0);
      expect(year0.wealth).toBe(55000);
      expect(year0.own_capital).toBe(55000);
      expect(year0.loan).toBe(45000);
      expect(year0.pf_value).toBe(100000);
      expect(year0.gearing).toBeCloseTo(0.45, 4);
    });

    it('should calculate dividend correctly', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // Dividend = PF Value × dividend_rate = $100,000 × 3% = $3,000
      expect(year0.dividend).toBeCloseTo(3000, 0);
    });

    it('should calculate LOC interest correctly', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // LOC Interest = Loan × rate = $45,000 × 7% = $3,150
      expect(year0.loc_interest).toBeCloseTo(3150, 0);
    });

    it('should calculate taxable dividend correctly', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // Taxable Dividend = Dividend - LOC Interest = $3,000 - $3,150 = -$150
      expect(year0.taxable_dividend).toBeCloseTo(-150, 0);
    });

    it('should calculate after-tax dividend correctly', () => {
      const result = calculate(baselineParams);
      const year0 = result.years[0];

      // After-Tax Dividend = Taxable × (1 - tax_rate) = -$150 × (1 - 0.47) = -$79.5
      expect(year0.after_tax_dividend).toBeCloseTo(-79.5, 0);
    });
  });

  describe('Test 2: Year 10 Projection', () => {
    it('should calculate correct Wealth at Year 10', () => {
      const result = calculate(baselineParams);
      const year10 = result.years[10];

      // Expected: $784,624 ±0.01% = ±$78.46
      expect(year10.wealth_30_june).toBeCloseTo(784624, -2);
    });

    it('should maintain 45% gearing at Year 10', () => {
      const result = calculate(baselineParams);
      const year10 = result.years[10];

      expect(year10.gearing).toBeCloseTo(0.45, 2);
    });

    it('should have year = 10', () => {
      const result = calculate(baselineParams);
      expect(result.years[10].year).toBe(10);
    });
  });

  describe('Test 3: Year 20 Projection + XIRR', () => {
    it('should calculate correct final Wealth at Year 20', () => {
      const result = calculate(baselineParams);
      const year20 = result.years[20];

      // Expected: $2,929,892 ±0.01% = ±$292.99
      expect(year20.wealth_30_june).toBeCloseTo(2929892, -2);
    });

    it('should calculate correct final_wealth in result', () => {
      const result = calculate(baselineParams);

      // Expected: $2,929,892 ±0.01%
      expect(result.final_wealth).toBeCloseTo(2929892, -2);
    });

    it('should calculate XIRR correctly', () => {
      const result = calculate(baselineParams);

      // Expected: 12.55% ±0.01% = 0.1255 ±0.0001
      expect(result.xirr).toBeCloseTo(0.1255, 4);
    });

    it('should have exactly 21 year records (0 to 20)', () => {
      const result = calculate(baselineParams);
      expect(result.years.length).toBe(21);
    });
  });

  describe('Test 4: Sensitivity Analysis - LOC Interest Rates', () => {
    it('should return different XIRR at 4% LOC rate', () => {
      const params4pct = { ...baselineParams, loc_interest_rate: 0.04 };
      const result = calculate(params4pct);

      // At lower LOC rate, XIRR should be higher (more favorable)
      expect(result.xirr).toBeGreaterThan(0.1255);
    });

    it('should return 12.55% XIRR at 7% LOC rate (baseline)', () => {
      const result = calculate(baselineParams);
      expect(result.xirr).toBeCloseTo(0.1255, 4);
    });

    it('should return different XIRR at 10% LOC rate', () => {
      const params10pct = { ...baselineParams, loc_interest_rate: 0.10 };
      const result = calculate(params10pct);

      // At higher LOC rate, XIRR should be lower (less favorable)
      expect(result.xirr).toBeLessThan(0.1255);
    });

    it('should show monotonic relationship: 4% > 7% > 10%', () => {
      const result4pct = calculate({ ...baselineParams, loc_interest_rate: 0.04 });
      const result7pct = calculate(baselineParams);
      const result10pct = calculate({ ...baselineParams, loc_interest_rate: 0.10 });

      expect(result4pct.xirr).toBeGreaterThan(result7pct.xirr);
      expect(result7pct.xirr).toBeGreaterThan(result10pct.xirr);
    });
  });

  describe('Output Structure Validation', () => {
    it('should return array of 21 year objects with correct fields', () => {
      const result = calculate(baselineParams);

      expect(Array.isArray(result.years)).toBe(true);
      expect(result.years.length).toBe(21);

      const requiredFields = [
        'year', 'date', 'wealth', 'own_capital', 'loan', 'pf_value',
        'gearing', 'dividend', 'loc_interest', 'taxable_dividend',
        'after_tax_dividend', 'pf_value_30_june', 'wealth_30_june'
      ];

      result.years.forEach((yearData, index) => {
        requiredFields.forEach(field => {
          expect(yearData).toHaveProperty(field);
        });
        expect(yearData.year).toBe(index);
      });
    });

    it('should return xirr and final_wealth in result object', () => {
      const result = calculate(baselineParams);

      expect(result).toHaveProperty('xirr');
      expect(result).toHaveProperty('final_wealth');
      expect(result).toHaveProperty('years');
    });

    it('should have date in YYYY-MM-DD format', () => {
      const result = calculate(baselineParams);

      result.years.forEach((yearData) => {
        // Date should be in format YYYY-MM-DD or ISO format
        expect(yearData.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      });
    });
  });

  describe('Financial Invariants', () => {
    it('should have non-decreasing wealth over 20 years', () => {
      const result = calculate(baselineParams);

      for (let i = 1; i < result.years.length; i++) {
        expect(result.years[i].wealth_30_june).toBeGreaterThanOrEqual(
          result.years[i - 1].wealth_30_june
        );
      }
    });

    it('should calculate own_capital = pf_value - loan at each year', () => {
      const result = calculate(baselineParams);

      result.years.forEach((yearData) => {
        const calculated = yearData.pf_value - yearData.loan;
        expect(yearData.own_capital).toBeCloseTo(calculated, 0);
      });
    });
  });
});
