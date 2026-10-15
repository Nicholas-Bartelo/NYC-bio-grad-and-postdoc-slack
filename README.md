# NYC Grad & Postdoc Slack — daily posts

Automated **8:00 AM Eastern** posts to nycgradpostdocs.slack.com:

| Channel | What posts |
| --- | --- |
| `#topic-of-day` | One biology discussion topic |
| `#opportunities-biotech` | One biotech opportunity |
| `#opportunities-vc` | One VC / investing opportunity |
| `#opportunities-pharma` | One pharma opportunity |
| `#opportunities-entrepreneurship` | One entrepreneurship / startup opportunity |

No LLM / Grok usage. GitHub Actions + Slack incoming webhooks.

## Repo layout

| Path | Role |
| --- | --- |
| `data/topics.json` | Topic of the Day bank |
| `data/opportunities/*.json` | Per-field opportunity banks |
| `scripts/post-daily-topic.mjs` | Topic poster |
| `scripts/post-daily-opportunities.mjs` | Opportunities poster (link safety checks) |
| `.github/workflows/daily-topic.yml` | Daily 8 AM Eastern schedule |

## Slack webhooks (one per channel)

In your Slack app → **Incoming Webhooks** → **Add New Webhook to Workspace** for each channel, then add GitHub Actions secrets:

| GitHub secret | Slack channel |
| --- | --- |
| `SLACK_WEBHOOK_URL` | `#topic-of-day` (already set if topic posts work) |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH` | `#opportunities-biotech` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_VC` | `#opportunities-vc` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA` | `#opportunities-pharma` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP` | `#opportunities-entrepreneurship` |

GitHub → **Settings → Secrets and variables → Actions → New repository secret**.

## Opportunity post format

Each opportunity entry must include:

- **company**
- **companyType** — e.g. VC firm, pharma company, nonprofit research institute, YC startup
- **mission** — scientific / strategic goal of the organization
- **listingsUrl** — careers / open-positions **board** (many roles; must differ from `featured.applyUrl`)
- **featured.position** — one specific live role/program
- **featured.description** — short summary of that specific posting (“What we’re sharing”)
- **featured.responsibilities** — from that job description
- **featured.qualifications** — from that job description
- **featured.applyUrl** — direct link to that specific JD/application (not the board)
- **postedBy** (optional)

Slack posts include company type + scientific goal, a role-specific summary, responsibilities/qualifications for that posting, a **specific apply** link, and a separately labeled listings-page link.

Example JSON:

```json
{
  "company": "Example Bio",
  "companyType": "Clinical-stage biotech company",
  "mission": "Develop enzyme-replacement therapies for rare metabolic disease.",
  "listingsUrl": "https://example.com/careers",
  "featured": {
    "position": "Research Associate, Discovery Biology",
    "description": "Full-time wet-lab RA supporting target-validation assays for Example Bio’s lead metabolic program (requisition 123).",
    "responsibilities": "Run target-validation assays and document results with the discovery team.",
    "qualifications": "BS/MS in biology with 1+ years wet-lab experience.",
    "applyUrl": "https://example.com/careers/research-associate-123"
  },
  "postedBy": {
    "name": "Alex Kim",
    "contact": "@alex or alex@example.com"
  }
}
```

Dead/404 links are skipped automatically at post time.

### No repeats
Posted opportunities are recorded in `data/opportunities/posted-history.json`.
Each channel will not reuse a listing until every usable listing in that
channel has been posted once; then the cycle resets. The GitHub Action
commits history updates after a successful run.

Scheduled runs also post **at most once per Eastern calendar day** per
channel. A manual **Run workflow** can post again the same day (still
respecting the no-repeat cycle for which listing is chosen).

## Test

1. Add the four opportunity webhook secrets  
2. GitHub → **Actions → Daily Slack posts → Run workflow**  
3. Check all five channels  

## Local test

```bash
export SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_VC='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP='https://hooks.slack.com/services/...'
export FORCE_POST=1
node scripts/post-daily-opportunities.mjs
```

## Maintain the lists

Seed data uses real public careers / program pages so links stay useful, but openings change. Edit the JSON files and commit to `main` whenever you want fresher roles. Prefer employer career pages over URL shorteners.
