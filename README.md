# Topic of the Day

Posts one biology discussion topic every day at **8:00 AM Eastern** to
`#topic-of-day` on **nycgradpostdocs.slack.com**.

## What’s in this repo

| Path | Role |
| --- | --- |
| `data/topics.json` | Rotating bank of biology topics |
| `scripts/post-daily-topic.mjs` | Picks today’s topic and posts to Slack |
| `.github/workflows/daily-topic.yml` | Daily schedule (8 AM Eastern year-round) |

## Setup (already done if webhook secret exists)

1. Slack app → **Incoming Webhooks** → webhook for `#topic-of-day`
2. GitHub → **Settings → Secrets and variables → Actions**
3. Secret `SLACK_WEBHOOK_URL` = that webhook URL

## Test

GitHub → **Actions → Daily biology topic → Run workflow**

## Local test

```bash
export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'
node scripts/post-daily-topic.mjs
```

## Cost

No LLM / Grok usage. One short GitHub Actions job per day + a free Slack webhook.
