# Debt Recycler AU - Deployment Guide

## Architecture Overview

```
┌─────────────────┐
│   React Client  │
│   (CloudFront)  │
└────────┬────────┘
         │
┌────────▼────────────────────┐
│   AWS API Gateway           │
│   (REST API + CORS)         │
└────────┬────────────────────┘
         │
┌────────▼──────────────────────┐
│   AWS Lambda                  │
│   (Node.js 18 - Express App)  │
└────────┬──────────────────────┘
         │
┌────────▼────────────────────┐
│   AWS RDS PostgreSQL        │
│   (Multi-AZ - Optional)     │
└─────────────────────────────┘
```

## Prerequisites

- AWS Account with appropriate IAM permissions
- AWS CLI v2 configured with credentials
- SAM CLI installed (`pip install aws-sam-cli`)
- Node.js 18+ installed
- GitHub account with repository access

## Deployment Steps

### 1. Prepare Secrets (GitHub)

Add the following secrets to your GitHub repository:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DB_USERNAME (default: postgres)
DB_PASSWORD (min 8 chars)
```

Settings → Secrets and variables → Actions → New repository secret

### 2. Local Deployment Testing

```bash
# Build backend
npm install
npm test

# Build frontend
cd client
npm install
npm run build
cd ..

# Test locally with SAM
sam local start-api
```

### 3. Automatic Deployment (CI/CD)

Deployments run automatically on push to `main` branch via GitHub Actions:

1. **Test Phase**
   - Install dependencies
   - Run linter
   - Run full test suite (43+ tests)
   - Upload coverage report

2. **Deploy Phase**
   - Build Docker images
   - Deploy with CloudFormation
   - Create/update Lambda, API Gateway, RDS
   - Configure security groups & networking

3. **Notify Phase**
   - Report deployment status
   - Show API endpoint in logs

### 4. Manual Deployment

```bash
# Deploy with CloudFormation
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name debt-recycler-au \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    DBUsername=postgres \
    DBPassword=<your-secure-password> \
  --region ap-southeast-2

# Get outputs
aws cloudformation describe-stacks \
  --stack-name debt-recycler-au \
  --query 'Stacks[0].Outputs' \
  --region ap-southeast-2
```

### 5. Database Initialization

After deployment, initialize the database:

```bash
# Get RDS endpoint from CloudFormation outputs
export DB_HOST=<endpoint>
export DB_USER=postgres
export DB_PASSWORD=<password>

# Run migrations
npm run migrate
```

## Infrastructure Details

### Lambda Function
- **Name**: debt-recycler-api
- **Runtime**: Node.js 18.x
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Handler**: src/index.handler
- **VPC**: Private subnets for RDS access

### API Gateway
- **Stage**: prod
- **Type**: REST API
- **CORS**: Enabled for all origins
- **Authentication**: (Optional - add API Keys/OAuth as needed)

### RDS PostgreSQL
- **Instance Class**: db.t3.micro (free tier eligible)
- **Version**: PostgreSQL 15.3
- **Storage**: 20 GB (gp3)
- **Backups**: 7-day retention
- **MultiAZ**: Disabled (enable for production)

### CloudWatch
- **Logs**: Lambda execution logs + PostgreSQL logs
- **Alarms**:
  - API Error Rate > 5 errors in 5 min
  - API Latency > 5000ms average

## Monitoring & Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/debt-recycler-api --follow

# View RDS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=debt-recycler-db \
  --start-time 2026-03-25T00:00:00Z \
  --end-time 2026-03-26T00:00:00Z \
  --period 300 \
  --statistics Average

# Check alarms
aws cloudwatch describe-alarms \
  --alarm-names debt-recycler-api-errors debt-recycler-api-latency
```

## Cost Estimation (Monthly)

| Service | Tier | Estimated Cost |
|---------|------|-----------------|
| Lambda | 1M requests | $0.20 |
| API Gateway | 1M requests | $3.50 |
| RDS | db.t3.micro | $8-12 |
| Data Transfer | 10 GB out | $0.90 |
| CloudWatch | Basic | ~$5 |
| **Total** | | **~$20-25/month** |

*Free tier covers most costs for the first 12 months*

## Scaling

### Read Heavy
- Enable RDS Read Replica
- Add CloudFront distribution for static assets
- Enable API Gateway caching

### Write Heavy
- Upgrade RDS instance class
- Enable Multi-AZ for failover
- Consider Lambda concurrency limits

## Security

1. **Network**
   - Lambda in private subnets
   - RDS security group restricts to Lambda only
   - No public database access

2. **Secrets**
   - Store DB password in AWS Secrets Manager
   - Rotate credentials every 90 days

3. **API**
   - Add API key requirement
   - Implement OAuth 2.0 for user authentication
   - Enable WAF for DDoS protection

## Troubleshooting

### Lambda timeout
- Increase timeout in template.yaml
- Check database connectivity in VPC

### Database connection errors
- Verify RDS security group rules
- Check Lambda VPC configuration
- Confirm environment variables are set

### API Gateway CORS errors
- Check CORS settings in template.yaml
- Verify client sends correct headers
- Test with curl: `curl -H "Origin: http://localhost:3000" ...`

## Rollback

```bash
# Delete stack (preserve RDS snapshots)
aws cloudformation delete-stack \
  --stack-name debt-recycler-au \
  --region ap-southeast-2
```

## Support

For issues, check:
1. CloudWatch Logs: `/aws/lambda/debt-recycler-api`
2. CloudFormation Events: Stack creation/update status
3. GitHub Actions: Deploy workflow logs
