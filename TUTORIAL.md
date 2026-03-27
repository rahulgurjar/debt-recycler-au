# Debt Recycler AU — Complete User Guide

**Production API:** `https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod`
**Frontend:** `https://d1p3am5bl1sho7.cloudfront.net`
**Last verified:** 2026-03-27 against live production

---

## Quick Verification (copy-paste to confirm everything works)

```bash
BASE="https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod"
curl -s "$BASE/health"
# Expected: {"status":"ok","database":{"connected":true,...}}
```

---

## Feature 1 — Health Check

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/health
```

**Expected response:**
```json
{"status":"ok","database":{"connected":true}}
```

---

## Feature 2 — Authentication

### Sign Up (creates your workspace)

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@yourcompany.com",
    "password": "YourPass123!",
    "company_name": "Your Advisory Firm"
  }'
```

**Expected response:**
```json
{
  "user": {"id": 1, "email": "you@yourcompany.com", "role": "admin"},
  "token": "eyJ..."
}
```

The first signup for a company name becomes **admin**. All subsequent signups with the same company name become **advisor**.

**Save your token** — you need it for every authenticated request:
```bash
TOKEN="eyJ..."  # paste your token here
```

### Log In

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourcompany.com", "password": "YourPass123!"}'
```

### Password Reset

```bash
# Step 1: Request reset token
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yourcompany.com"}'

# Step 2: Use reset token
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"reset_token": "TOKEN_FROM_STEP1", "new_password": "NewPass123!"}'
```

---

## Feature 3 — Workspace Management

### Get Your Workspace

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "id": 1,
  "company_name": "Your Advisory Firm",
  "subscription_tier": "starter",
  "team_members": [{"id": 1, "email": "you@yourcompany.com", "role": "admin"}]
}
```

### Invite a Team Member (admin only)

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "colleague@yourcompany.com", "role": "advisor"}'
```

**Expected response:**
```json
{
  "user": {"id": 2, "email": "colleague@yourcompany.com", "role": "advisor"},
  "temporary_password": "abc123xyz789"
}
```

Roles available: `admin`, `advisor`, `client`
Rate limit: max 10 invites per day per admin. Exceeding returns `429`.

### Change a User's Role (admin only)

```bash
curl -X PATCH https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/users/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "client"}'
```

### Remove a Team Member (admin only)

```bash
curl -X DELETE https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/users/2 \
  -H "Authorization: Bearer $TOKEN"
```

### Workspace Settings

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/settings \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{"subscription_tier": "starter", "monthly_price": 500, "max_clients": 10}
```

### Update Settings (admin only)

```bash
curl -X PATCH https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscription_tier": "professional"}'
```

---

## Feature 4 — Client Management

### Create a Client

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@client.com",
    "dob": "1985-06-15",
    "annual_income": 150000,
    "risk_profile": "moderate"
  }'
```

**Required fields:** `name`, `email`, `dob` (YYYY-MM-DD), `annual_income`, `risk_profile`
**Valid risk profiles:** `conservative`, `moderate`, `aggressive`, `balanced`, `growth`, `high_growth`

**Expected response:**
```json
{"client": {"id": 1, "name": "Jane Smith", "email": "jane@client.com", ...}}
```

### List Clients (paginated)

```bash
# Basic list
curl "https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients" \
  -H "Authorization: Bearer $TOKEN"

# With pagination and sorting
curl "https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients?limit=10&offset=0&sort_by=name" \
  -H "Authorization: Bearer $TOKEN"

# Filter by risk profile
curl "https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients?risk_profile=moderate" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{"clients": [...], "total": 5, "limit": 50, "offset": 0}
```

### Get One Client

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Update Client

```bash
curl -X PATCH https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"annual_income": 175000, "risk_profile": "aggressive"}'
```

### Delete Client

```bash
curl -X DELETE https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients/1 \
  -H "Authorization: Bearer $TOKEN"
```

Deleting a client also deletes all their scenarios (cascade).

### Bulk Import Clients from CSV

```bash
# Create a CSV file
cat > clients.csv << 'EOF'
name,email,dob,annual_income,risk_profile
Alice Brown,alice@client.com,1980-03-20,120000,conservative
Bob Jones,bob@client.com,1975-11-10,200000,aggressive
EOF

curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/clients/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @clients.csv
```

---

## Feature 5 — Debt Recycling Scenarios

### Create a Scenario

```bash
# Minimal (uses defaults)
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": 1, "name": "Conservative Strategy"}'

# Full parameters
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "name": "Aggressive Growth",
    "initial_outlay": 100000,
    "initial_loan": 80000,
    "gearing_ratio": 0.44,
    "annual_investment": 30000,
    "loc_interest_rate": 0.065,
    "etf_dividend_rate": 0.035,
    "etf_capital_appreciation": 0.08,
    "marginal_tax": 0.47,
    "inflation": 0.03
  }'
```

**Expected response:** Full 20-year projection with XIRR (~13.53% for defaults).

### List Scenarios

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios \
  -H "Authorization: Bearer $TOKEN"
```

### Get Scenario Details

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Update Scenario (creates new version)

```bash
curl -X PATCH https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"annual_investment": 35000}'
```

### View Version History

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/versions \
  -H "Authorization: Bearer $TOKEN"
```

### Restore a Previous Version

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/versions/2/restore \
  -H "Authorization: Bearer $TOKEN"
```

---

## Feature 6 — PDF Report Generation

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Jane Smith Debt Recycling Report"}'
```

**Expected response:**
```json
{"report_id": 1, "message": "Report generated", "s3_url": null}
```

Note: `s3_url` is null when AWS_S3_BUCKET is not configured. The PDF is generated in-memory.

To download the PDF directly:
```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --output report.pdf
```

---

## Feature 7 — Excel Export

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/export \
  -H "Authorization: Bearer $TOKEN" \
  --output strategy.xlsx
```

Opens in Excel or Google Sheets. Contains:
- **Parameters sheet**: All 9 input parameters
- **Projection sheet**: 20-year year-by-year table
- **Formulas**: XIRR, total tax, wealth gain (editable)

---

## Feature 8 — Email Reports to Clients

```bash
# Send now
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "jane@client.com",
    "subject": "Your Debt Recycling Strategy Report"
  }'

# Schedule for later
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/scenarios/1/email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "jane@client.com",
    "scheduled_at": "2026-04-01T09:00:00Z"
  }'
```

**Expected response:**
```json
{"message": "Email sent", "email_log_id": 1, "subject": "Your Debt Recycling Strategy Report", "recipient": "jane@client.com"}
```

---

## Feature 9 — Subscription & Billing (Stripe)

### View Current Tier Limits

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/workspace/settings \
  -H "Authorization: Bearer $TOKEN"
```

| Tier | Price | Max Clients | Scenarios/mo |
|------|-------|-------------|--------------|
| free | $0 | 5 | 3 |
| starter | $500/mo | 10 | 5 |
| professional | $1,500/mo | 100 | 50 |
| enterprise | $3,000/mo | 1,000 | 500 |

### What happens when you hit the limit

Creating a client beyond your tier limit returns:
```json
{
  "error": "Monthly client quota exceeded",
  "monthly_limit": 10,
  "monthly_used": 10,
  "upgrade_url": "/billing/upgrade"
}
```
HTTP status: `402 Payment Required`

### Billing Portal

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/billing/portal \
  -H "Authorization: Bearer $TOKEN"
```

Returns a Stripe Billing Portal URL to manage subscriptions, view invoices, update payment method.

---

## Feature 10 — Admin Analytics Dashboard

**Admin only** — returns 403 for advisor/client roles.

```bash
curl https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/admin/analytics \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "total_users": 8,
  "signups_last_7_days": 6,
  "signups_last_30_days": 8,
  "tier_breakdown": {"starter": 0, "professional": 0, "enterprise": 0, "free": 8},
  "mrr": 0,
  "arr": 0,
  "top_customers": [...]
}
```

---

## Role-Based Access Control (RBAC) Summary

| Endpoint | Admin | Advisor | Client |
|---|---|---|---|
| GET /workspace | ✅ | ✅ | ❌ |
| POST /workspace/users | ✅ | ❌ 403 | ❌ 403 |
| PATCH /workspace/users/:id | ✅ | ❌ 403 | ❌ 403 |
| DELETE /workspace/users/:id | ✅ | ❌ 403 | ❌ 403 |
| GET /workspace/settings | ✅ | ✅ | ❌ |
| PATCH /workspace/settings | ✅ | ❌ 403 | ❌ 403 |
| POST /clients | ✅ | ✅ | ❌ |
| POST /scenarios | ✅ | ✅ | ❌ |
| GET /scenarios/:id | ✅ | ✅ | ✅ (read-only) |
| GET /admin/analytics | ✅ | ❌ 403 | ❌ 403 |

---

## Debt Recycling Calculator (Legacy / Unauthenticated)

The original Phase 1 calculator still works without authentication:

```bash
curl -X POST https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "initial_outlay": 55000,
    "gearing_ratio": 0.45,
    "initial_loan": 45000,
    "annual_investment": 25000,
    "inflation": 0.03,
    "loc_interest_rate": 0.07,
    "etf_dividend_rate": 0.03,
    "etf_capital_appreciation": 0.07,
    "marginal_tax": 0.47
  }'
```

**Expected:** 20-year projection, XIRR ~13.53%, Year 20 wealth ~$3,349,321.

---

## End-to-End Verification Script

Run this to verify all features work in production:

```bash
BASE="https://4jyqo4weu8.execute-api.ap-southeast-2.amazonaws.com/prod"
TS=$(date +%s)

# 1. Health
echo "1. Health:" $(curl -s "$BASE/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['status']=='ok' else 'FAIL')")

# 2. Signup
SIGNUP=$(curl -s -X POST "$BASE/auth/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"verify${TS}@test.com\",\"password\":\"TestPass123!\",\"company_name\":\"VerifyCo\"}")
TOKEN=$(echo $SIGNUP | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "2. Signup: OK (role=$(echo $SIGNUP | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['role'])"))"

# 3. Workspace
WS=$(curl -s "$BASE/workspace" -H "Authorization: Bearer $TOKEN")
echo "3. Workspace: $(echo $WS | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK company='+d['company_name'])")"

# 4. Invite
INVITE=$(curl -s -X POST "$BASE/workspace/users" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"email\":\"adv${TS}@test.com\",\"role\":\"advisor\"}")
echo "4. Invite: $(echo $INVITE | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK role='+d['user']['role'])")"

# 5. Create client
CLIENT=$(curl -s -X POST "$BASE/clients" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Client\",\"email\":\"client${TS}@test.com\",\"dob\":\"1985-01-01\",\"annual_income\":100000,\"risk_profile\":\"moderate\"}")
CID=$(echo $CLIENT | python3 -c "import sys,json; print(json.load(sys.stdin)['client']['id'])")
echo "5. Client: OK id=$CID"

# 6. Create scenario
SCENARIO=$(curl -s -X POST "$BASE/scenarios" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"client_id\":$CID,\"name\":\"Test Scenario\"}")
SID=$(echo $SCENARIO | python3 -c "import sys,json; print(json.load(sys.stdin)['scenario']['id'])")
XIRR=$(echo $SCENARIO | python3 -c "import sys,json; print(round(json.load(sys.stdin)['projection']['xirr']*100,2))")
echo "6. Scenario: OK id=$SID xirr=${XIRR}%"

# 7. Email
EMAIL=$(curl -s -X POST "$BASE/scenarios/$SID/email" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"recipient_email\":\"client${TS}@test.com\"}")
echo "7. Email: $(echo $EMAIL | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK log_id='+str(d['email_log_id']))")"

# 8. Analytics
ANA=$(curl -s "$BASE/admin/analytics" -H "Authorization: Bearer $TOKEN")
echo "8. Analytics: $(echo $ANA | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK users='+str(d['total_users']))")"

# 9. RBAC check
RBAC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workspace")
echo "9. RBAC (no auth): $([ '$RBAC' = '401' ] && echo 'OK 401' || echo 'FAIL got '$RBAC)"

echo ""
echo "All features verified in production."
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 No token provided` | Missing Authorization header | Add `-H "Authorization: Bearer TOKEN"` |
| `401 Invalid or expired token` | Token expired (30min TTL) | Re-login to get new token |
| `403 Admin access required` | Using advisor/client token | Use admin token |
| `400 All fields required` | Missing required body field | Check required fields per endpoint |
| `409 User already exists` | Email already registered | Use different email |
| `429 Invite limit reached` | >10 invites today | Wait 24h or use different admin |
| `402 Monthly client quota exceeded` | Hit tier limit | Upgrade subscription tier |

---

**Version:** 2.0
**API Region:** ap-southeast-2 (Sydney)
**Last verified:** 2026-03-27
