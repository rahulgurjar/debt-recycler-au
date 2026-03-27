# Production Domain Setup - Cheap Web URL for Debt Recycler AU

## Overview
This guide explains how to set up a professional, affordable domain name for your Debt Recycler AU production deployment instead of using the long AWS API Gateway URL.

**Current URL** (long and unmemorable):
```
https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/
```

**Target URL** (professional and memorable):
```
https://debtrecycler.au/
https://debtrecycler.com.au/
https://calculator.debtrecycler.com/
```

---

## Step 1: Register a Domain (Budget: $10-20/year)

### Option A: AWS Route53 (Integrated with AWS)
**Pros**: One-click integration, automatic SSL, same AWS account
**Cost**: $0.50/year domain registration for most .au domains

```bash
# List available domains
aws route53domains list-domains

# Register domain
aws route53domains register-domain \
  --domain-name debtrecycler.au \
  --duration-in-years 1 \
  --registrant-contact File://registrant.json
```

**registrant.json**:
```json
{
  "FirstName": "Your Name",
  "LastName": "Last Name",
  "ContactType": "INDIVIDUAL",
  "OrganizationName": "Your Company",
  "AddressLine1": "123 Main St",
  "City": "Sydney",
  "State": "NSW",
  "ZipCode": "2000",
  "CountryCode": "AU",
  "PhoneNumber": "+61212345678",
  "Email": "admin@example.com"
}
```

### Option B: Namecheap (Cheap, Popular)
**Pros**: Low cost, easy renewal
**Cost**: $5-15/year depending on TLD

1. Visit [namecheap.com](https://www.namecheap.com)
2. Search for domain: `debtrecycler.au`
3. Select `.au`, `.com.au`, or `.net.au` (all good choices)
4. Check out ($8.99/year typical)
5. Complete domain registration

### Option C: GoDaddy (Well-known)
**Pros**: Recognizable brand, promotional pricing
**Cost**: $2.99-12.99/year (often has specials)

1. Visit [godaddy.com](https://www.godaddy.com)
2. Search domain name
3. Add to cart and checkout
4. Use coupon code for discount (easy to find)

### Option D: Local AU Registrar (NetRegistry, NameDrive)
**Pros**: Local support, Australian company
**Cost**: $10-20/year

---

## Step 2: Configure DNS to Point to AWS

Once you have a domain registered, point it to your API Gateway endpoint.

### AWS Route53 (Recommended)
If using Route53 for domain registration, setup is automatic.

```bash
# Create hosted zone for your domain
aws route53 create-hosted-zone \
  --name debtrecycler.au \
  --caller-reference $(date +%s)

# Create alias record pointing to API Gateway
aws route53 change-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --change-batch file://change-batch.json
```

**change-batch.json**:
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "debtrecycler.au",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1p3am5bl1sho7.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
```

### Manual DNS Configuration (Any Registrar)

If using Namecheap, GoDaddy, or other registrar:

1. **For CloudFront (Frontend)**:
   - Log into your domain registrar (Namecheap/GoDaddy)
   - Go to DNS Settings
   - Add CNAME record:
     - **Host**: `@` or leave blank
     - **Value**: `d1p3am5bl1sho7.cloudfront.net` (your CloudFront domain)
     - **TTL**: 3600

   Note: Some registrars don't allow CNAME for root domain. Use ALIAS or A record if available.

2. **For API Gateway (If not using CloudFront)**:
   - Add CNAME record:
     - **Host**: `api` (creates api.debtrecycler.au)
     - **Value**: `4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com`
     - **TTL**: 3600

---

## Step 3: Update API Gateway Custom Domain (Optional but Recommended)

If using API Gateway directly (not CloudFront), set up custom domain:

```bash
# Create custom domain name in API Gateway
aws apigateway create-domain-name \
  --domain-name api.debtrecycler.au \
  --certificate-arn arn:aws:acm:ap-southeast-2:YOUR_ACCOUNT_ID:certificate/YOUR_CERT

# Create API mapping
aws apigatewayv2 create-api-mapping \
  --domain-name api.debtrecycler.au \
  --api-id YOUR_API_ID \
  --stage prod \
  --api-mapping-key '/'
```

---

## Step 4: SSL/TLS Certificate (Free with CloudFront/API Gateway)

**AWS Services Provide Free SSL**:
- CloudFront: Includes default SSL certificate
- API Gateway: Includes default SSL certificate
- ACM: Free certificates for your domain

### Request ACM Certificate (for custom domain)
```bash
aws acm request-certificate \
  --domain-name debtrecycler.au \
  --validation-method DNS \
  --region us-east-1

# Validate domain by adding DNS record
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERT
```

---

## Step 5: Verify DNS Resolution

Test that your domain points correctly:

```bash
# Check CNAME record
nslookup debtrecycler.au
dig debtrecycler.au

# Should return CloudFront or API Gateway IP

# Test HTTPS
curl -I https://debtrecycler.au/

# Expected response: 200 OK with valid certificate
```

---

## Step 6: Update Frontend Configuration

Update your React frontend to use the new domain:

```bash
# In .env or build configuration
REACT_APP_API_URL=https://debtrecycler.au/prod

# Rebuild frontend
cd client
npm run build
REACT_APP_API_URL=https://debtrecycler.au/prod npm run build
```

Or update hardcoded URLs in React components:

```javascript
// client/src/api/client.js
const API_BASE_URL = process.env.REACT_APP_API_URL
  || 'https://debtrecycler.au/prod';
```

---

## Step 7: Update Tutorial & Documentation

Update all URLs in documentation:

```bash
# Find and replace old URL
grep -r "4jyqo4weu8.execute-api" . --include="*.md" --include="*.js"

# Replace with new domain
sed -i 's|4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com|debtrecycler.au|g' \
  TUTORIAL.md DEPLOYMENT.md client/src/components/*.js
```

---

## Cost Breakdown (Annual)

| Component | Cost | Notes |
|-----------|------|-------|
| Domain (.au) | $10-20/year | Route53: $0.50/year, Namecheap: $8.99 |
| SSL Certificate | FREE | AWS CloudFront/API Gateway provide free cert |
| CloudFront Distribution | FREE* | 1GB/month free, ~$0.085/GB after |
| Route53 Hosted Zone | $0.50/month | Only if using Route53 DNS |
| **Total** | **~$15-30/year** | Extremely affordable |

*Free tier covers most personal/small business traffic

---

## Example Configurations

### For debtrecycler.au (main site)
```
Domain: debtrecycler.au
DNS: CNAME to CloudFront: d1p3am5bl1sho7.cloudfront.net
SSL: Free from CloudFront
Status: Production ready
```

### For calculator.debtrecycler.com (subdomain)
```
Domain: calculator.debtrecycler.com
DNS: CNAME to API Gateway: 4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com
SSL: Free from API Gateway
Status: Optional, for branding
```

### For api.debtrecycler.au (API only)
```
Domain: api.debtrecycler.au
DNS: A record to API Gateway
SSL: ACM certificate required
Status: For public API consumption
```

---

## Troubleshooting

### Issue: Domain not resolving
```bash
# Check DNS propagation (takes 24-48 hours)
# Use: https://mxtoolbox.com/
# Or: nslookup debtrecycler.au
```

### Issue: SSL certificate error
```bash
# Verify certificate is issued for your domain
aws acm describe-certificate --certificate-arn <ARN>

# Check CloudFront is using certificate
aws cloudfront get-distribution-config --id <DIST_ID>
```

### Issue: API returns 403 Forbidden from new domain
- Update CORS settings in API Gateway
- Whitelist your new domain in Lambda environment
- Check CloudFront forwarding headers

---

## Quick Start Command (AWS CLI)

```bash
#!/bin/bash
DOMAIN="debtrecycler.au"
EMAIL="admin@example.com"

# 1. Register domain
aws route53domains register-domain \
  --domain-name $DOMAIN \
  --duration-in-years 1 \
  --registrant-contact FirstName=Your,LastName=Name,Email=$EMAIL,ContactType=INDIVIDUAL

# 2. Create hosted zone
ZONE_ID=$(aws route53 create-hosted-zone \
  --name $DOMAIN \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' \
  --output text)

# 3. Create alias record to CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch "
  {
    'Changes': [{
      'Action': 'CREATE',
      'ResourceRecordSet': {
        'Name': '$DOMAIN',
        'Type': 'A',
        'AliasTarget': {
          'HostedZoneId': 'Z2FDTNDATAQYW2',
          'DNSName': 'd1p3am5bl1sho7.cloudfront.net',
          'EvaluateTargetHealth': false
        }
      }
    }]
  }"

echo "Domain setup in progress. May take 24-48 hours to fully propagate."
echo "Test with: curl https://$DOMAIN/"
```

---

## Recommended Final Setup

For best user experience and lowest cost:

1. **Register domain**: `debtrecycler.au` via Route53 ($0.50/year)
2. **Use CloudFront** for frontend (free tier covers most traffic)
3. **Use API Gateway** for backend (1M free requests/month)
4. **Enable CloudFront** for all static assets + API proxying
5. **SSL**: Automatic with CloudFront + Route53

**Final URL**: `https://debtrecycler.au/` (professional, memorable, affordable)

---

**Last Updated**: 2026-03-26
**Status**: Ready for implementation
