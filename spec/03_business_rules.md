# Business Rules — Debt Recycling Calculations

## Australian Tax Rules (2026)

### Capital Gains Tax (CGT)

**CGT Discount (12-month rule):**
- Hold investment < 12 months: 100% of capital gain taxed at your marginal rate
- Hold investment ≥ 12 months: **50% of capital gain** taxed at your marginal rate (CGT discount applies)

**Calculation:**
```
Taxable Capital Gain = (Sale Price - Cost Base) × 50%  [if held ≥12 months]
Tax on CGT = Taxable Capital Gain × Marginal Tax Rate
```

**Example:** $100k property appreciates to $150k after 20 years:
- Capital gain: $50,000
- Taxable gain (50% discount): $25,000
- At 45% tax rate: $25,000 × 0.45 = **$11,250 tax**

### Investment Loan Interest Deduction (Critical)

**Key Rule:** Interest on money borrowed to invest in income-producing assets is tax-deductible.

**Eligibility:**
- LOC must be used to purchase investment assets (ETFs, shares, rental property)
- Interest must be for investment purpose (not personal use)
- Investment must produce assessable income (dividends, rental income)

**Tax Benefit:**
```
Annual Tax Saving = LOC Interest × Marginal Tax Rate

Example: $100k loan at 7% = $7,000 interest/year
At 45% tax: $7,000 × 0.45 = $3,150 tax saving/year
```

### Dividend Income & Franking Credits

**Australian Dividends:**
- Franking credit: company has already paid tax on profits
- Franked dividends: grossed up by franking credit
- Unfranked dividends: no credit (e.g., ETFs tracking international indices)

**Calculation:**
```
Dividend Income = Cash Dividend + Franking Credit (may apply)
Taxable Income = Dividend Income
Tax = Taxable Income × Marginal Tax Rate
Net Dividend = Cash Dividend - (Tax - Franking Credit)
```

**Our Model Simplification:** Assumes 30% dividend yield is after-tax equivalent. Adjust based on franking for specific ETFs.

### Marginal Tax Rates (2026)

```
Income           | Tax Rate (incl. Medicare Levy @ 2%)
$0 - $18,200     | 0%
$18,201 - $45k   | 21% + 2% = 23%
$45,001 - $120k  | 37% + 2% = 39%
$120,001 - $180k | 45% + 2% = 47%
$180,001+        | 47% + 2% = 49%
```

**Our Model Baseline:** 47% marginal tax (high-income earner, $120k-$180k+)

---

## Core Formulas (from Spreadsheet Model)

### Year 0 (Initial Outlay)

```
Own Capital = Initial Outlay
Loan = Initial Loan
PF Value = Own Capital + Loan
Gearing = Loan / PF Value
```

Example (spreadsheet row 4):
- Initial Outlay: $55,000
- Initial Loan: $45,000
- PF Value on 1 July: $100,000
- Gearing: 45%

### Years 1-20

For each year Y (starting July 1):

**1. Property Value Growth**
```
PF Value Start = PF Value(Y-1, 30 June) × (1 + capital_appreciation_rate)
```

**2. Dividend & Tax**
```
Dividend (before tax) = PF Value × dividend_rate
LOC Interest = Loan(Y-1) × loc_interest_rate
Taxable Dividend = Dividend - LOC Interest
After-Tax Dividend = Taxable Dividend × (1 - marginal_tax_rate)
```

**3. Cash Flow & New Investment**
```
Annual Cash Investment = (Initial Annual Investment) × (1 + inflation)^(Y-1)
```

**4. New Loan Amount**
```
New Loan = Gearing Ratio × PF Value(30 June, Year Y)
Additional Loan = New Loan - Old Loan (if positive, borrow more; if negative, pay down)
```

**5. End of Year (30 June)**
```
PF Value(30 June) = PF Value + After-Tax Dividend + Annual Investment
Own Capital(30 June) = PF Value(30 June) - Loan
Wealth(30 June) = Own Capital
```

### XIRR Calculation

Internal Rate of Return: the discount rate at which the Net Present Value (NPV) of all cash flows = 0.

**Cash Flows:**
- Year 0: -Initial Outlay (outflow)
- Years 1-20: -Annual Investment (outflows)
- Year 20 (end): +Final Wealth (inflow)

**Formula:**
```
NPV = -55000 + (-25750 / 1+r) + ... + (2929892 / (1+r)^20) = 0
Solve for r = XIRR
```

**Example (spreadsheet Table 1, row 4):**
- Initial outlay: $55,000
- Annual investment: $25,000 (inflated 3% annually)
- Final wealth (Year 20): $2,929,892
- XIRR: 12.55%

## Constraints & Rules

1. **Gearing target:** Maintain 45% throughout (or user-specified %)
2. **Annual investment:** Starts at $25k, inflates at 3% annually
3. **Tax rate:** 47% (marginal tax + 2% Medicare Levy for high earners)
4. **LOC interest rate:** Variable (tested at 4%, 4.5%, ... 12%)
5. **ETF dividend rate:** 3% (can vary in sensitivity analysis)
6. **ETF capital appreciation:** 7% (can vary in sensitivity analysis)

## User Forecasting & Stats

### User Profile Data

The calculator should collect (optional, for forecasting):

**Demographics:**
- Age (affects time horizon and investment risk tolerance)
- Current income (determines marginal tax rate)
- Marital status (impacts tax planning, potential joint investment)
- Employment status (stability affects loan serviceability)

**Financial Snapshot:**
- Property value (current market estimate)
- Existing mortgage balance (non-deductible debt)
- Other investments (diversification consideration)
- Risk tolerance (conservative/moderate/aggressive)

**Calculation Inputs (already collected):**
- Initial equity available to borrow
- Annual cash investment capacity
- Target gearing ratio
- Time horizon (typically 10-20 years)

### Forecasting Features

**1. XIRR by Income Bracket**
Show how XIRR changes if tax rate varies:
```
45% tax rate: 12.55% XIRR
39% tax rate: 10.2% XIRR  (lower income)
49% tax rate: 13.8% XIRR  (higher income)
```

**2. Age-Based Projections**
Adjust time horizon based on age:
```
Age 35, retire at 65: 30-year forecast
Age 45, retire at 65: 20-year forecast
Age 55, retire at 65: 10-year forecast
```

**3. Sensitivity to Interest Rates**
Critical for feasibility:
```
LOC at 5%: 14.2% XIRR (favorable conditions)
LOC at 7%: 12.55% XIRR (current assumption)
LOC at 9%: 11.0% XIRR (rising rate risk)
```

**4. Risk Profile Recommendation**
Based on user inputs:
- **Conservative:** Property-only, min gearing (10-20%)
- **Moderate:** Mixed portfolio, standard gearing (40-50%)
- **Aggressive:** Diversified ETFs, higher gearing (60-75%)

### User Statistics to Display

At end of projection:

```
Key Metrics:
- Initial Investment: $55,000
- Annual Cash Contribution: $25,000 (inflated annually)
- Total Cash Invested Over 20 Years: ~$638,000
- Final Portfolio Value: $2,929,892
- Final Own Capital (Wealth): $2,929,892 - Loan

Risk Indicators:
- Peak Gearing: 45% (maintained throughout)
- Interest Coverage Ratio: Year 20 dividend / annual LOC interest
- Loan Serviceability: Annual LOC interest / annual income

Time to Financial Goals:
- Break-even vs property-only strategy: Year 5
- Wealth double: Year X
- Retirement readiness (custom target): Year Y
```

---

## Test Cases

### Test 1: Baseline (Spreadsheet Row 4)
Input:
- Initial outlay: $55,000
- Gearing ratio: 45%
- Initial loan: $45,000
- Annual investment: $25,000
- Inflation: 3%
- LOC interest: 7%
- Dividend: 3%
- Capital appreciation: 7%
- Tax: 47%

Expected Output (Year 0, 30 June):
- PF Value: $106,921
- Wealth: $61,841
- XIRR: 12.55%

### Test 2: Year 10 (Spreadsheet Row 14)
Expected:
- Wealth: $784,624
- PF Value: $1,268,777
- Gearing: 45%

### Test 3: Year 20 (Spreadsheet Row 24)
Expected:
- Wealth: $2,929,892
- PF Value: $5,416,021
- XIRR: 12.55%

## Sensitivity Analysis

Spreadsheet includes 2 sensitivity tables:

**Table 2A:** Gearing v/s XIRR @ 10 Years  
- Columns: LOC Interest (0%, 5%, 10%, 15%, ... 90%)
- Rows: ETF Cap Appreciation (4%, 4.5%, 5%, ... 12%)
- Result: XIRR value at Year 10

**Table 2B:** Gearing v/s XIRR @ 10 Years  
- Columns: ETF Dividend (2%, 3%, 4%, 5%, 6%, 7%, 8%)
- Rows: Gearing ratio (0%, 5%, 10%, ... 90%)
- Result: XIRR value at Year 10

## Tolerance

All calculations must match spreadsheet ±0.01% (e.g., $100,000 ± $10).
