# Specification: Stripe Setup Feature

**Task ID:** 10
**Status:** In Progress
**Owner:** Claude Code (Spec-Driven Development)

## Overview

Integrate Stripe for subscription billing. Support recurring payments for different tiers (Starter, Professional, Enterprise). Track subscription status and manage customer portal access.

## Value Proposition

- **For Advisors:** Easy subscription signup and management
- **For Business:** Recurring revenue, automatic billing, reduced churn
- **Automation:** Webhook handling for billing events (payment success, failed, cancelled)

## Requirements

### R1: Stripe Customer Creation
- Create Stripe customer record when advisor signs up
- Store stripe_customer_id in users table
- Link customer to user account (email, name)
- Support customer metadata (subscription_tier, company_name)

### R2: Subscription Management
- POST /subscribe endpoint to create/update subscription
- Support three tiers: Starter ($29/mo), Professional ($99/mo), Enterprise ($299/mo)
- Store subscription_id, tier, status, current_period_end in users table
- Automatic subscription renewal (Stripe handles)
- Cancel subscription with DELETE /subscription endpoint

### R3: Payment Methods
- Support credit/debit cards via Stripe Payment Method API
- Save payment method for recurring billing
- Allow customers to change payment method
- PCI-DSS compliant (use Stripe.js on frontend)

### R4: Webhook Handling
- Listen for Stripe webhook events on /webhooks/stripe
- Handle charge.succeeded, charge.failed, customer.subscription.updated, customer.subscription.deleted
- Update user subscription status based on webhook events
- Retry webhook processing on transient failures
- Verify webhook signature for security

### R5: Subscription Portal
- POST /customer-portal endpoint
- Generate Stripe-hosted customer portal session
- Customer can manage payment methods, billing history, cancel subscription
- Redirect to portal with session ID

### R6: Invoicing
- Generate invoice on subscription creation
- Send invoice to customer email
- Invoice metadata includes scenario limits, features
- Support invoice PDF download via S3

### R7: Error Handling
- Handle Stripe errors (card declined, insufficient funds, etc.)
- Clear error messages to user
- Retry failed payments with exponential backoff
- DLQ for unrecoverable payment failures

### R8: Testing
- Support Stripe test mode (publishable/secret keys)
- Test cards: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (decline)
- Webhook testing via Stripe CLI

## Verification Tests (V1-V5)

### V1: Customer Creation
```javascript
✅ PASSED if:
- POST /auth/signup creates Stripe customer
- stripe_customer_id stored in database
- Customer visible in Stripe dashboard
- Metadata includes advisor email and company
```

### V2: Subscription Creation
```javascript
✅ PASSED if:
- POST /subscribe creates subscription
- subscription_id stored in database
- Subscription status is 'active'
- Next billing date (current_period_end) set correctly
- Tier correctly reflects selected plan
```

### V3: Payment Processing
```javascript
✅ PASSED if:
- Valid card (4242...) succeeds with status 200
- Invalid card (4000...) fails with status 402
- Payment method saved for future use
- Invoice generated and sent to email
```

### V4: Webhook Handling
```javascript
✅ PASSED if:
- charge.succeeded webhook updates subscription status
- charge.failed webhook marks subscription failed
- customer.subscription.deleted webhook deactivates tier
- Webhook signature verified correctly
- Webhook response code 200 on success
```

### V5: Subscription Cancellation
```javascript
✅ PASSED if:
- DELETE /subscription cancels subscription
- subscription_status set to 'cancelled'
- Advisor loses access to premium features
- Stripe shows cancelled status
- Refund issued if within refund window
```

## Acceptance Criteria

- [ ] All 5 verification tests pass
- [ ] Stripe test mode working (no real charges)
- [ ] Webhook handling verified with Stripe CLI
- [ ] Payment errors handled gracefully
- [ ] All tests pass (no database required for unit tests)
- [ ] Code follows existing patterns (error handling, logging)

## Implementation Notes

- Use `stripe` npm package (v11+)
- Store Stripe keys in .env (STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY)
- Webhook endpoint must verify signature with `stripe.webhooks.constructEvent`
- Subscription status in users: 'active', 'past_due', 'cancelled', 'trial'
- Use idempotency keys for subscription creation to prevent duplicates
- Stripe recommended: use Sessions for payment flows (not direct charge creation)

## Files to Create/Modify

- `tests/stripe_setup.test.js` - 25+ test cases
- `src/stripe.js` - Stripe integration module
- `src/api.js` - Add /subscribe, /subscription, /customer-portal, /webhooks/stripe endpoints
- `scripts/schema.sql` - Add stripe_customer_id, subscription_id, subscription_tier, subscription_status columns to users table
