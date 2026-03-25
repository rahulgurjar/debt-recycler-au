# HTTPS Support Specification

## Overview
Enable HTTPS (TLS/SSL encryption) for the debt-recycler-au frontend to ensure secure communication between browser clients and the application. This involves configuring AWS CloudFront with ACM certificates and S3 backend hosting.

## Requirements

### Functional Requirements
1. **HTTPS Enforcement**: Frontend MUST be served exclusively over HTTPS
2. **Certificate**: Valid ACM certificate covering the production domain
3. **HTTP Redirect**: HTTP traffic (port 80) redirects to HTTPS (port 443)
4. **API Security**: Backend Lambda API calls use HTTPS
5. **Performance**: CloudFront CDN caches static assets globally

### Non-Functional Requirements
1. **Performance**: Page load time < 3 seconds from browser
2. **Availability**: 99.9% uptime (CloudFront + S3)
3. **Security**: TLS 1.2+ only, no insecure protocols

## Architecture Changes

### Current State
```
S3 Website Hosting (HTTP)
├─ Frontend: debt-recycler-au-frontend-*.s3-website-ap-southeast-2.amazonaws.com
└─ No encryption, no CDN
```

### Target State
```
ACM Certificate + CloudFront CDN
├─ Frontend Domain: [production domain - TBD]
├─ CloudFront Distribution
│  ├─ Origin: S3 bucket (private, not website hosting)
│  ├─ Behavior: Serve static assets with cache headers
│  └─ Viewer Protocol: Redirect HTTP to HTTPS
└─ S3 Origin Access Control (OAC) for private bucket access
```

## Implementation Tasks

### Task 1: Prepare S3 Backend
- Create private S3 bucket (no website hosting)
- Configure bucket policy for CloudFront OAC access only
- Disable public access
- Enable versioning for rollback capability

### Task 2: CloudFront Distribution
- Create CloudFront distribution pointing to S3 origin
- Configure cache behaviors for static assets
- Set TTL for index.html = 0 (no cache)
- Set TTL for assets (CSS, JS, images) = 86400 seconds (1 day)

### Task 3: ACM Certificate
- Request certificate for production domain (requires DNS validation)
- Associate certificate with CloudFront distribution

### Task 4: Update Infrastructure Code
- Update template.yaml with CloudFront + S3 resources
- Add S3 Origin Access Control definition
- Remove direct S3 website hosting configuration

### Task 5: Deployment Pipeline
- Update GitHub Actions to sync frontend to private S3 bucket
- Remove direct S3 website sync step
- Add CloudFront cache invalidation after deployment

## Verification with Chrome MCP

### V1: HTTPS Availability
```javascript
// Navigate to production URL
await page.goto('https://[domain]', { waitUntil: 'networkidle2' });

// Verify HTTPS is active
const protocol = page.url().split(':')[0];
assert.strictEqual(protocol, 'https', 'Protocol must be HTTPS');

// Verify certificate is valid (no warnings)
const securityDetails = page.response().securityDetails();
assert(securityDetails.valid(), 'Certificate must be valid');
```

**Success Criteria**: Page loads successfully over HTTPS without certificate warnings

### V2: HTTP Redirect
```javascript
// Navigate to HTTP URL
const response = await page.goto('http://[domain]', {
  waitUntil: 'networkidle2'
});

// Verify redirect to HTTPS
const finalURL = page.url();
assert(finalURL.startsWith('https://'), 'HTTP must redirect to HTTPS');
```

**Success Criteria**: HTTP requests redirect to HTTPS URL

### V3: API Communication Over HTTPS
```javascript
// Monitor network requests
const requests = [];
page.on('response', (response) => {
  requests.push({
    url: response.url(),
    status: response.status(),
    headers: response.headers()
  });
});

// Trigger API call via Calculate button
await page.click('[data-testid="calculate-button"]');
await page.waitForResponse(r => r.url().includes('/api/calculate'));

// Verify API endpoint is HTTPS
const apiRequests = requests.filter(r => r.url().includes('/api/calculate'));
assert(apiRequests.length > 0, 'API call must be made');
assert(apiRequests[0].url.startsWith('https://'), 'API must use HTTPS');
```

**Success Criteria**: Backend API calls use HTTPS protocol

### V4: CloudFront Performance
```javascript
// Measure page load time
const startTime = Date.now();
await page.goto('https://[domain]', { waitUntil: 'networkidle2' });
const loadTime = Date.now() - startTime;

// Check cache headers from CloudFront
const response = await page.goto('https://[domain]');
const cacheControl = response.headers()['cache-control'];
const xCache = response.headers()['x-cache'];

assert(loadTime < 3000, `Page must load in < 3s, took ${loadTime}ms`);
assert(xCache && (xCache.includes('Hit') || xCache.includes('Miss')), 'CloudFront must serve request');
```

**Success Criteria**: Page loads < 3 seconds with CloudFront cache headers

### V5: End-to-End HTTPS Calculation
```javascript
// Full workflow verification
await page.goto('https://[domain]');

// Fill form
await page.fill('[name="initialOutlay"]', '55000');
await page.fill('[name="loanAmount"]', '45000');
await page.fill('[name="gearingRatio"]', '0.45');

// Submit calculation
await page.click('[data-testid="calculate-button"]');
await page.waitForSelector('[data-testid="year-20-wealth"]');

// Verify results over HTTPS
const wealth = await page.locator('[data-testid="year-20-wealth"]').textContent();
const expectedWealth = '$3,349,321';
assert(wealth.includes(expectedWealth), `Final wealth must be ${expectedWealth}`);

// Verify chart renders
const chartCanvas = await page.locator('canvas[role="img"]');
assert(await chartCanvas.isVisible(), 'Chart must be visible');
```

**Success Criteria**: Complete calculation workflow works over HTTPS with correct results

## Rollback Plan
If CloudFront deployment fails:
1. Revert S3 bucket to previous state
2. Update Route53 to point domain back to S3 website endpoint
3. Disable CloudFront distribution
4. Rollback GitHub Actions to previous deployment step

## Testing Evidence Required
1. Chrome DevTools screenshot showing HTTPS lock icon and certificate details
2. Network tab showing all requests over HTTPS
3. CloudFront cache hit/miss headers in response
4. Performance metrics (page load time < 3s)
5. End-to-end calculation validation with final wealth matching spec

## Dependencies
- AWS ACM certificate (requires domain ownership)
- Route53 or equivalent DNS control (for CNAME/A record updates)
- CloudFront distribution creation permissions in AWS IAM

## Acceptance Criteria
- [ ] Frontend serves exclusively over HTTPS
- [ ] HTTP requests redirect to HTTPS
- [ ] Valid ACM certificate (no warnings)
- [ ] API calls encrypted with HTTPS
- [ ] CloudFront cache working (cache-control headers present)
- [ ] Page load time < 3 seconds
- [ ] End-to-end calculation works and returns correct results
- [ ] Chrome MCP verification suite passes all 5 verification steps
