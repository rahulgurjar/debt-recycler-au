# Business Rules — Debt Recycling Calculations

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
