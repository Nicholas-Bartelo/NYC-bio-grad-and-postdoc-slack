# NYC Grad & Postdoc Slack — daily posts

Automated **8:00 AM Eastern** posts to nycgradpostdocs.slack.com:

| Channel | What posts |
| --- | --- |
| `#topic-of-day` | One biology discussion topic |
| `#opportunities-biotech` | One biotech opportunity |
| `#opportunities-vc` | One VC / investing opportunity |
| `#opportunities-pharma` | One pharma opportunity |
| `#opportunities-entrepreneurship` | One entrepreneurship / startup opportunity |
| `#opportunities-spatial` *(private)* | **Two** NYC or Remote spatial-omics roles |

No LLM / Grok usage. GitHub Actions + Slack incoming webhooks.

## Repo layout

| Path | Role |
| --- | --- |
| `data/topics.json` | Topic of the Day bank |
| `data/opportunities/*.json` | Per-field opportunity banks (`spatial.json` = spatial channel) |
| `scripts/post-daily-topic.mjs` | Topic poster |
| `scripts/post-daily-opportunities.mjs` | Opportunities poster (link safety checks) |
| `.github/workflows/daily-topic.yml` | Daily 8 AM Eastern schedule |

## Full setup walkthrough (including private `#opportunities-spatial`)

### 1. Create / confirm the Slack channel

1. In Slack, create `#opportunities-spatial` (private is fine).
2. Invite the members who should see posts.
3. You will also invite your **Incoming Webhooks** Slack app into this private channel when you add the webhook (step 2).

### 2. Create an Incoming Webhook for the private channel

Use the **same Slack app** that already posts to your other opportunity channels:

1. Open [api.slack.com/apps](https://api.slack.com/apps) → select your app.
2. **Incoming Webhooks** → **On**.
3. **Add New Webhook to Workspace**.
4. Pick **`#opportunities-spatial`** (private channels appear in the picker if you are a member).
5. Copy the URL — it must look like:

   `https://hooks.slack.com/services/T…/B…/…`

   Do **not** use an `app-settings` / “manage distribution” URL.

Private vs public does not change the webhook mechanics: once the webhook is installed into that channel, GitHub Actions can post there.

### 3. Add the GitHub Actions secret

GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| GitHub secret | Slack channel |
| --- | --- |
| `SLACK_WEBHOOK_URL` | `#topic-of-day` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH` | `#opportunities-biotech` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_VC` | `#opportunities-vc` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA` | `#opportunities-pharma` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP` | `#opportunities-entrepreneurship` |
| `SLACK_WEBHOOK_URL_OPPORTUNITIES_SPATIAL` | `#opportunities-spatial` *(new)* |

Paste the hooks.slack.com URL from step 2 into `SLACK_WEBHOOK_URL_OPPORTUNITIES_SPATIAL`.

### 4. How the daily job works

1. GitHub Actions workflow **Daily Slack posts** targets **~10:00 AM Eastern** (`14:00` UTC in EDT, `15:00` UTC in EST), with same-hour and afternoon catch-up ticks if GitHub delays the cron. Manual **Run workflow** still works. Your computer does **not** need to be on.
2. GitHub cron is often delayed or throttled (this repo’s old every-15-minute schedule often skipped most ticks). Scheduled runs always attempt to post; already-posted-today history ensures only one post per Eastern day.
3. One job posts the topic, then opportunities, then commits history files.
4. Most opportunity channels post **1** featured role. `#opportunities-spatial` posts **2** separate Slack messages (`1/2` and `2/2`).
5. Each opportunity message includes company type, scientific goal, role-specific summary, responsibilities, qualifications, a **specific JD apply link**, and a separate **listings board** link.
6. Links are health-checked; dead links are skipped.
7. History is saved in `data/opportunities/posted-history.json` and `data/topic-last-posted.json`.
8. Manual **Run workflow** can repost the same day.

### 5. Spatial channel rules (seed data)

Entries in `data/opportunities/spatial.json` are curated for:

- **Location:** New York City **or** Remote
- **Work:** spatial transcriptomics, spatial proteomics, H&E / digital pathology imaging, spatial metabolomics, or spatial multiomics
- **Preference:** industry roles first; academic postdoc/researcher roles allowed

### 6. Test

1. Confirm the spatial secret exists.
2. GitHub → **Actions → Daily Slack posts → Run workflow**.
3. Check `#opportunities-spatial` for **two** new posts (and the other channels as usual).

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
- **location** / **spatialFocus** — required for spatial seed quality (shown in Slack when present)
- **postedBy** (optional)

Example JSON:

```json
{
  "company": "Example Bio",
  "companyType": "Clinical-stage biotech company",
  "mission": "Develop enzyme-replacement therapies for rare metabolic disease.",
  "location": "New York, NY or Remote",
  "spatialFocus": "Spatial transcriptomics (Xenium)",
  "listingsUrl": "https://example.com/careers",
  "featured": {
    "position": "Computational Biologist, Spatial Transcriptomics",
    "description": "Full-time role analyzing Xenium datasets for Example Bio’s oncology program.",
    "responsibilities": "Run spatial QC and niche analysis; align H&E to spatial coordinates.",
    "qualifications": "PhD or MS with spatial transcriptomics experience; Python or R.",
    "applyUrl": "https://example.com/careers/spatial-comp-bio-123"
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

## Local test

```bash
export SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_VC='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP='https://hooks.slack.com/services/...'
export SLACK_WEBHOOK_URL_OPPORTUNITIES_SPATIAL='https://hooks.slack.com/services/...'
export FORCE_POST=1
node scripts/post-daily-opportunities.mjs
```

## Maintain the lists

Seed data uses real public careers / program pages so links stay useful, but openings change. Edit the JSON files and commit to `main` whenever you want fresher roles. Prefer employer career pages over URL shorteners. For `#opportunities-spatial`, keep only NYC or Remote roles that clearly involve spatial omics / H&E spatial imaging.
