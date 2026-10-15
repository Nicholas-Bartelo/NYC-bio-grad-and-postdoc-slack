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

Each opportunity entry includes:

- **company**
- **title** (role / program)
- **description**
- **applyUrl** (must be `https://…`; shorteners are rejected)
- **postedBy** (optional): `{ "name": "…", "contact": "…" }`

Example:

```json
{
  "company": "Example Bio",
  "title": "Research Associate",
  "description": "Short plain-language description of the role.",
  "applyUrl": "https://example.com/careers/123",
  "postedBy": {
    "name": "Alex Kim",
    "contact": "@alex or alex@example.com"
  }
}
```

Add new listings at the top or bottom of the matching file under `data/opportunities/`. The daily picker rotates through entries with safe links.

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
