# Debt Recycler AU — Project Overview

## What is Debt Recycling?

Debt recycling is a wealth-building strategy for Australian property investors:

1. Own a property worth $100k financed with $45k debt (45% gearing)
2. Use home equity to borrow money (via Line of Credit) for investment
3. Invest borrowed money in ETFs (generates dividends + capital growth)
4. Deduct LOC interest from taxable income (tax deduction)
5. Reinvest returns to increase gearing and grow wealth

Over 20 years with compounding, this can dramatically increase investor wealth vs owning property debt-free.

## User Personas

**Sarah, Property Investor**
- Age 45, owns rental property + primary residence
- Wants to know: "If I borrow $45k against my equity and invest in ETFs, how much wealthier will I be in 20 years?"
- Concerned about: interest rates, tax implications, market downturns

**Marcus, Financial Adviser**
- Advises high-net-worth clients on wealth strategies
- Uses debt recycling projections to show clients potential outcomes
- Needs: sensitivity analysis (how does XIRR change if rates go up?)

## Success Criteria

1. **Calculation Accuracy** — Core algorithm produces results ±0.01% of spreadsheet model
2. **User Experience** — Input form → 20-year table → key metrics in <2 seconds
3. **Scenarios** — Users can save/compare multiple scenarios
4. **Transparency** — All formulas documented and testable
5. **Sensitivity** — Show XIRR impact of changing: gearing, LOC rate, dividend %, cap appreciation %

## Key Metrics

Users care about:
- **Total Wealth (Year 20)** — projected net worth
- **XIRR** — annualized return on invested capital
- **Gearing Ratio** — loan balance / property value (maintain 45% target)
- **Cash Flow** — annual out-of-pocket investment needed

## Out of Scope

- Actual loan origination or credit checking
- Tax advice or financial advisory
- Real-time market data or ETF recommendations
- Mobile app (web only for MVP)
