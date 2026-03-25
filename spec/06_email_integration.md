# Specification: Email Integration Feature

**Task ID:** 9
**Status:** In Progress
**Owner:** Claude Code (Spec-Driven Development)

## Overview

Send reports and scenario updates to clients via email using AWS SES. Advisors can email PDF reports, Excel exports, and scenario summaries. Support scheduled email campaigns and client notifications.

## Value Proposition

- **For Advisors:** Send professional reports to clients without leaving the app
- **For Clients:** Receive emailed reports and scenario updates with tracking
- **For Business:** Enable advisor-client communication, reduce support tickets

## Requirements

### R1: Email Report Sending
- POST /scenarios/:id/send-email endpoint
- Send previously generated PDF report to client email
- Support custom email subject and message body
- Include report metadata in email (scenario name, client name, date)
- Validate recipient email address before sending

### R2: Email Delivery Tracking
- Store email send records in database with timestamp, recipient, status
- Support email status tracking: pending, sent, failed, bounced
- Include delivery failure reason in record
- Email history visible in scenario detail view

### R3: AWS SES Integration
- Use AWS SES for email delivery
- Support both sandbox mode (verified emails only) and production mode
- Automatic retry on SES throttling (max 3 retries with exponential backoff)
- Handle SES errors gracefully (bounce, complaint, permanent failure)

### R4: Email Templates
- Professional HTML email template with company branding
- Include scenario summary table in email body
- Add report download link (S3 presigned URL)
- Include advisor contact information in footer
- Support plain text fallback

### R5: Scheduled Emails
- POST /clients/:id/schedule-report endpoint
- Schedule report delivery on specific date/frequency (once, weekly, monthly)
- Background job to process scheduled emails daily
- Cancel scheduled emails with DELETE endpoint

### R6: Bulk Email Campaign
- POST /clients/send-bulk-email endpoint
- Send email to multiple clients (all, filtered by tier, custom list)
- Track campaign performance (sent count, failed count, bounce rate)
- Campaign history and audit trail

### R7: Access Control
- Only advisor (report owner) can send to their own clients
- Admin can send any email
- Client can receive emails sent to their email address

### R8: Performance & Reliability
- Email sends complete in <3 seconds (SES operation)
- Support up to 100 concurrent email sends
- Idempotent email sends (duplicate prevention)
- DLQ (Dead Letter Queue) for failed emails

## Verification Tests (V1-V5)

### V1: Email Send Success
```javascript
✅ PASSED if:
- POST /scenarios/:id/send-email returns 200
- Email record created in database
- AWS SES SendEmail called successfully
- Response includes email_id, status: 'sent', timestamp
```

### V2: Email Template & Content
```javascript
✅ PASSED if:
- HTML email contains scenario summary table
- Email includes advisor contact information
- Subject line includes scenario name
- Presigned S3 URL to PDF included
- Plain text fallback available
```

### V3: Scheduled Email Delivery
```javascript
✅ PASSED if:
- Schedule endpoint stores scheduled_emails record
- Scheduled date/frequency stored correctly
- Background job triggers scheduled emails on due date
- Scheduled email marked as sent after delivery
```

### V4: Bulk Email Campaign
```javascript
✅ PASSED if:
- POST /clients/send-bulk-email accepts client list
- Sends to all specified clients
- Campaign record created with metadata
- Returns campaign_id and status with send counts
```

### V5: Access Control
```javascript
✅ PASSED if:
- Non-authenticated user gets 401
- Different advisor gets 403 (not their client)
- Report owner (advisor) succeeds with 200
- Admin succeeds with 200
```

## Acceptance Criteria

- [ ] All 5 verification tests pass
- [ ] AWS SES integration tested in sandbox mode
- [ ] Email template renders correctly in major email clients
- [ ] Scheduled emails execute correctly (test with fake date)
- [ ] Retry logic handles SES throttling
- [ ] All test failures resolve (no database required for unit tests)
- [ ] Code follows existing patterns (error handling, RBAC, logging)

## Implementation Notes

- Use `nodemailer` with AWS SES transport for email sending
- Store email_logs table: {id, user_id, recipient_email, subject, status, sent_at, error_reason}
- Store scheduled_emails table: {id, user_id, client_id, frequency, next_send_date, active}
- Background job: check scheduled_emails table daily, send if next_send_date <= today
- Presigned URLs valid for 24 hours
- Retry transient errors (timeout, throttling) but not permanent (invalid email, bounced)

## Files to Create/Modify

- `tests/email_integration.test.js` - 30+ test cases
- `src/email.js` - Email module with SES integration
- `src/email-templates.js` - HTML/plain text templates
- `src/api.js` - Add /scenarios/:id/send-email, /clients/:id/schedule-report, /clients/send-bulk-email endpoints
- `scripts/schema.sql` - Add email_logs, scheduled_emails tables
