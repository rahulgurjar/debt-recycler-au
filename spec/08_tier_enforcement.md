# Specification: Tier Enforcement Feature

**Task ID:** 11
**Status:** In Progress
**Owner:** Claude Code (Spec-Driven Development)

## Overview

Enforce subscription tier limits on feature access. Premium features available only to active subscribers of appropriate tiers. Gracefully degrade UI for unpaid users while maintaining free tier access.

## Value Proposition

- **For Business:** Drives adoption of paid tiers through feature gating
- **For Users:** Clear path from free to premium features
- **Operations:** Prevent API abuse through rate limiting and usage tracking

## Requirements

### R1: Tier-Based Access Control
- Free tier (no subscription):
  - 3 scenarios/month, 5 clients, basic calculation only
  - No email, Excel export, API access
- Starter tier ($29):
  - 5 scenarios/month, 10 clients, PDF export
- Professional ($99):
  - 50 scenarios/month, 100 clients, PDF + Excel + Email
- Enterprise ($299):
  - 500 scenarios/month, 1000 clients, all features + API + custom branding

### R2: Feature Access Middleware
- tierMiddleware(requiredTier) - check user subscription
- Return 402 Payment Required if tier insufficient
- Include remaining quota in response headers
- Log tier enforcement events

### R3: Usage Tracking
- Track monthly scenario count per user
- Track client count per user
- Reset monthly usage on billing cycle date
- Prevent overages (return 402 if quota exceeded)

### R4: Graceful Degradation
- Free users: show "Upgrade to unlock" on premium features
- Show feature availability in API response
- Link to billing/upgrade page
- Provide trial or sample data

### R5: Admin Tier Bypass
- Admins bypass all tier checks
- Admins can use all features without subscription
- Log admin access to premium features

### R6: Rate Limiting
- Free: 100 requests/hour
- Starter: 1,000 requests/hour
- Professional: 10,000 requests/hour
- Enterprise: 100,000 requests/hour

### R7: Trial Period
- 14-day free trial for new users
- Access to Professional tier features during trial
- Converts to Free tier after trial expires
- Email reminder before trial ends

### R8: Error Messages
- Clear, user-friendly messages
- Include next available action (upgrade, wait for reset, etc.)
- Link to billing/account settings

## Verification Tests (V1-V5)

### V1: Feature Access Control
```javascript
✅ PASSED if:
- Free user cannot access /scenarios/excel-export (402)
- Free user can access /scenarios/calculate (200)
- Professional user can access /scenarios/excel-export (200)
- Enterprise user can access all features (200)
```

### V2: Quota Enforcement
```javascript
✅ PASSED if:
- Free user can create 3 scenarios/month (201)
- 4th scenario creation returns 402 with "Quota exceeded"
- Quota resets on next billing cycle
- Professional user has 50 scenario quota
```

### V3: Rate Limiting
```javascript
✅ PASSED if:
- Free user gets 429 after 100 requests/hour
- Starter user gets 429 after 1000 requests/hour
- Rate limit headers show remaining/reset time
- Rate limit resets hourly
```

### V4: Admin Bypass
```javascript
✅ PASSED if:
- Admin accesses premium feature without subscription (200)
- Admin creates unlimited scenarios
- Access logged with admin context
```

### V5: Trial Period
```javascript
✅ PASSED if:
- New user has 14-day trial (Professional access)
- User can access Professional features without payment
- Trial expires after 14 days (converts to Free)
- Reminder email sent before trial ends
```

## Acceptance Criteria

- [ ] All 5 verification tests pass
- [ ] tierMiddleware prevents unauthorized access
- [ ] Usage tracking accurate (scenarios, clients)
- [ ] Rate limiting enforced correctly
- [ ] Admin bypass working without side effects
- [ ] Trial period correctly implemented
- [ ] Error messages clear and actionable
- [ ] All tests pass (no database required for unit tests)

## Implementation Notes

- tierMiddleware returns 402 Payment Required (HTTP standard for subscription required)
- Usage tracking: monthly_scenarios_used, monthly_clients_used columns in users table
- Reset logic: triggered on subscription.current_period_end
- Rate limiting: use in-memory cache or Redis with key format: `rate_limit:${user_id}:${hour}`
- Trial: trial_ends_at column in users table, null if not in trial
- Admin bypass: check role === 'admin' before tier check

## Files to Create/Modify

- `tests/tier_enforcement.test.js` - 25+ test cases
- `src/middleware.js` - tierMiddleware and rateLimitMiddleware
- `src/api.js` - Apply middleware to protected endpoints
- `scripts/schema.sql` - Add monthly_scenarios_used, monthly_clients_used, trial_ends_at columns
