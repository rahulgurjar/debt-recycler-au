# Ralph Loop — Specification

## What Is a Ralph Loop?

A **ralph loop** is an agentic bash/Python loop that feeds implementation tasks from
the spec into Claude CLI, one at a time, letting Claude autonomously build the project.
"Ralphing" = iterative agentic construction with back pressure.

## Why "Ralph"?

Ralph is the driver. Ralph reads the checklist, picks the next task, calls Claude,
waits for it to finish, checks the result, and only then moves on. Ralph never rushes.

---

## Back Pressure Model

The loop MUST enforce back pressure to avoid hitting Claude plan usage limits.
Three layers of control:

```
Layer 1 — Minimum gap      : Never start a new task < MIN_DELAY_SECONDS after the last
Layer 2 — Rolling hour cap : Max MAX_CALLS_PER_HOUR invocations in any 60-minute window
Layer 3 — Daily budget     : Max MAX_CALLS_PER_DAY invocations in any 24-hour window
```

Plus exponential backoff on 429/rate-limit responses.

Natural back pressure also exists because `claude --max-turns N` blocks until
the task completes — a long-running task is itself a throttle.

---

## Task Design Rules

1. Each task prompt must be **self-contained** — include which spec files to read
2. Each task must produce **verifiable output** (a file, a test passing, etc.)
3. Tasks are **idempotent** — safe to re-run if something fails
4. Task prompts must NOT ask Claude to do >1 module at a time to keep turns short

---

## Checklist Integration

Ralph reads state from `.ralph_state.json` at repo root:
```json
{
  "completed": ["backend_src", "db_schema"],
  "calls_today": ["2026-03-08T02:00:00", ...],
  "calls_this_hour": [...],
  "last_call_at": "2026-03-08T03:15:00"
}
```

Reset with: `rm .ralph_state.json`

---

## Running Ralph

```bash
# Single pass (runs until all tasks done or limits hit)
python3 scripts/ralph_loop.py

# Dry run (show plan without calling claude)
python3 scripts/ralph_loop.py --dry-run

# Run specific task only
python3 scripts/ralph_loop.py --task db_schema

# Retry failed tasks
python3 scripts/ralph_loop.py --retry-failed
```

---

## Usage Limits (Conservative Defaults)

| Parameter              | Default | Rationale                                    |
|------------------------|---------|----------------------------------------------|
| MIN_DELAY_SECONDS      | 90      | ~40/hr theoretical max; we target far below  |
| MAX_CALLS_PER_HOUR     | 8       | ~20% of typical Pro plan rate                |
| MAX_CALLS_PER_DAY      | 30      | Leaves headroom for manual Claude use        |
| CLAUDE_MAX_TURNS       | 20      | Enough for most tasks; prevents runaway      |
| BACKOFF_BASE_SECONDS   | 60      | Initial wait on 429                          |
| MAX_BACKOFF_SECONDS    | 600     | 10 min cap — never wait more than this       |

Adjust these in `scripts/ralph_loop.py` config block at the top.

---

## Credential Blockers (Before Ralph Can Deploy)

Ralph can **build code** with zero credentials.
Ralph needs the following to **test against live services** or **deploy**:

### 🔴 Hard Blockers — Without These, Deploy Fails

| Credential              | Where to Get It                                       | How to Provide             |
|-------------------------|-------------------------------------------------------|----------------------------|
| `AWS_ACCESS_KEY_ID`     | AWS Console → IAM → Security Credentials              | GitHub Secret + env var    |
| `AWS_SECRET_ACCESS_KEY` | Same as above                                         | GitHub Secret + env var    |
| `TWILIO_ACCOUNT_SID`    | twilio.com dashboard                                  | `export` or SSM            |
| `TWILIO_AUTH_TOKEN`     | twilio.com dashboard                                  | `export` or SSM            |
| `TWILIO_PHONE_NUMBER`   | Twilio → Phone Numbers (buy a long code)              | `export` or SSM            |
| `DB_HOST`               | AWS RDS → your instance endpoint                      | `export` or SSM            |
| `DB_PASSWORD`           | Set when creating RDS (use SSM, not sam-template.yaml)| SSM only — see note below  |
| `STRIPE_SECRET_KEY`     | Stripe Dashboard → Developers → API Keys              | `export` or SSM            |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret          | `export` or SSM            |

### 🟡 Needed for Africa / Emerging Markets

| Credential                   | Where to Get It        |
|------------------------------|------------------------|
| `AFRICAS_TALKING_API_KEY`    | africastalking.com     |
| `AFRICAS_TALKING_USERNAME`   | africastalking.com     |

### ⚠️ Security Note — sam-template.yaml

`sam-template.yaml` currently has `MasterUserPassword: "luhar123"` hardcoded.
**Remove this before any commit to main.** Replace with an SSM reference:
```yaml
MasterUserPassword: !Sub '{{resolve:ssm-secure:/jamatxt/db/password}}'
```

---

## Providing Credentials Safely

```bash
# Never paste secrets in chat. Use env vars for the session:
export AWS_ACCESS_KEY_ID="AKIAxxxxxxxxxx"
export AWS_SECRET_ACCESS_KEY="xxxxxxxxxx"
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="xxxxxxxxxx"
export TWILIO_PHONE_NUMBER="+15551234567"
export STRIPE_SECRET_KEY="sk_test_xxxxxxxxxx"
export STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxx"
export DB_HOST="jamatxt-db.xxxxxxxxxx.ap-southeast-2.rds.amazonaws.com"
export DB_PASSWORD="your-secure-password"

# Then run ralph — it will pick them up and store in SSM during deploy task
python3 scripts/ralph_loop.py
```
