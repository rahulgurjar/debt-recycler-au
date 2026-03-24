# Development Rules — Debt Recycler AU

## Core Principles

- **Spec-Driven**: Every feature starts with a SPEC document (success criteria + tests)
- **Test-First**: Write tests BEFORE code. Tests are the source of truth.
- **Verifiable**: All claims backed by test evidence or manual verification
- **Financial Accuracy**: All calculations must match the spreadsheet model exactly
- **No Secrets in Code**: Use .env for credentials; sync via SSM Parameter Store for prod

## Workflow

1. Create Linear issue in debt-recycler-au project
2. Write SPEC (see `/spec/` templates)
3. Write tests (MUST FAIL before code)
4. Write code (MUST PASS tests)
5. Run full suite + linter
6. Commit + push to feature branch
7. PR review
8. Merge to main

## Test Requirements

- Unit tests for all calculations (Jest/Vitest)
- Integration tests for API endpoints
- E2E tests for user flows
- Minimum 80% code coverage
- All financial calculations verified against spec spreadsheet

## Code Quality

- Match existing patterns in codebase
- No hardcoded secrets (use .env)
- Format with prettier/eslint before commit
- Keep commits atomic and well-messaged

## Ralph Integration

Build driver for autonomous task execution:

```bash
python3 scripts/ralph_loop.py              # Run all pending tasks
python3 scripts/ralph_loop.py --dry-run    # Show status
python3 scripts/ralph_loop.py --task <id>  # Run one task
```

See RALPH_SPEC.md for details.
