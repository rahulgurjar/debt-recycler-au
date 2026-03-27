# Specification: Excel Export Feature

**Task ID:** 8
**Status:** In Progress
**Owner:** Claude Code (Spec-Driven Development)

## Overview

Export debt recycling scenarios to Excel spreadsheets with professional formatting, calculated formulas, and data validation. Advisors can send reports to clients with editable parameters.

## Value Proposition

- **For Advisors:** Export calculations to Excel for client review/editing without rerunning app
- **For Clients:** Receive editable spreadsheets matching their scenario parameters
- **For Business:** Premium feature driving advisor engagement + retention

## Requirements

### R1: Excel File Generation
- Export scenario to .xlsx format with scenario name as filename
- Include metadata sheet with scenario details (name, created_date, client_name, advisor_email)
- Include parameters sheet with input parameters (investment_amount, interest_rate, etc.)
- Include projections sheet with year-by-year data (year, geared_wealth, tax_benefit, cumulative_benefit)

### R2: Professional Formatting
- Header rows with background color (light blue #E7F0F7) and bold text
- Data rows with alternating background colors (white and #F5F5F5)
- Number formatting:
  - Currency columns: $#,##0.00
  - Percentage columns: 0.00%
  - Year column: 0
- Column widths auto-fitted to content
- Borders on all cells (thin, gray)
- Freezing header rows

### R3: Formula Support
- Year 20 wealth calculation as formula: `=SUM(C:C)` where C is geared_wealth column
- XIRR formula in summary: `=XIRR(cf_range, date_range)`
- Dynamic formulas so clients can adjust parameters
- Formula-calculated cells marked with light yellow background

### R4: Data Validation
- Investment amount: decimal, min 10000, max 5000000
- Interest rate: percentage, min 0.1%, max 20%
- Custom error message: "Enter valid investment amount ($10k - $5M)"

### R5: Access Control
- POST /scenarios/:id/export - Requires authentication + scenario ownership
- Only scenario owner or admin can export
- Return error 403 if user doesn't own scenario

### R6: Performance
- Export completes in <5 seconds
- File size <2 MB
- No memory leaks on concurrent exports

### R7: Error Handling
- 404 if scenario doesn't exist
- 401 if not authenticated
- 403 if not scenario owner
- 500 with descriptive message on file generation failure

## Verification Tests (V1-V5)

### V1: Excel File Structure
```javascript
✅ PASSED if:
- File downloads with Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Filename is "${scenarioName}.xlsx"
- File size is between 10 KB and 2 MB
```

### V2: Metadata Sheet
```javascript
✅ PASSED if:
- Metadata sheet exists with name "Metadata"
- Contains rows:
  - Scenario Name: {scenario.name}
  - Created: {created_date in ISO format}
  - Client: {client.name}
  - Advisor: {user.email}
```

### V3: Formatting & Styling
```javascript
✅ PASSED if:
- Header row background color is #E7F0F7
- Header text is bold
- Data rows have alternating colors (white, #F5F5F5)
- Currency columns formatted as $#,##0.00
- All cells have thin gray borders
- Header rows are frozen
```

### V4: Formula Support
```javascript
✅ PASSED if:
- Year 20 wealth cell contains formula (not static value)
- Formula references geared_wealth column
- Adjusting investment_amount parameter recalculates totals
- No errors when opening in Excel/Sheets
```

### V5: Access Control
```javascript
✅ PASSED if:
- Non-authenticated user gets 401
- Different user gets 403
- Scenario owner succeeds with 200
- Admin succeeds with 200
```

## Acceptance Criteria

- [ ] All 5 verification tests pass
- [ ] Excel files open without errors in Excel, Google Sheets, LibreOffice
- [ ] Performance: export <5 seconds for 20-year projection
- [ ] No test failures in jest suite
- [ ] Code follows existing patterns (error handling, RBAC, logging)

## Implementation Notes

- Use `exceljs` library (npm package already supports XLSX format)
- Store reference to exported file in scenario_reports table
- Support both scenarios created in app and imported from CSV
- Consider caching formatted workbooks for repeat exports

## Files to Create/Modify

- `tests/excel_export.test.js` - 25+ test cases
- `src/excel.js` - Excel generation module
- `src/api.js` - Add POST /scenarios/:id/export endpoint
