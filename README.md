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
- **mission** (≥1 sentence)
- **listingsUrl** — careers / open-positions board (labeled in Slack as a listings page, not one job)
- **featured.position** — one specific role/program
- **featured.responsibilities**
- **featured.qualifications**
- **featured.applyUrl** — link for that featured role (may be a specific JD or the board)
- **postedBy** (optional)

Slack posts include Company, Featured position, mission, responsibilities, qualifications, a featured apply link, and a clearly labeled listings-page link (**listings page = many open roles, not one job**).

Example JSON:

```json
{
  "company": "Example Bio",
  "mission": "Example Bio develops therapies for rare metabolic disease.",
  "listingsUrl": "https://example.com/careers",
  "featured": {
    "position": "Research Associate, Discovery Biology",
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
