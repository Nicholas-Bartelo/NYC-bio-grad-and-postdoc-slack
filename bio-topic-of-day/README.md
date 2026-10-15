# Biology Topic of the Day

Posts one biology discussion topic every day at **~8:00 AM Eastern** into
`#topic-of-day` on **nycgradpostdocs.slack.com**.

This setup does **not** need a Cursor Team account. It uses **GitHub Actions**
plus a Slack incoming webhook (simplest) or bot token.

## How it works

| Piece | Role |
| --- | --- |
| `data/topics.json` | Rotating bank of biology discussion topics |
| `scripts/post-daily-topic.mjs` | Picks today's topic and posts to Slack |
| `.github/workflows/daily-topic.yml` | Cron at `0 12 * * *` UTC (~8 AM EDT) |

## One-time Slack setup (webhook — recommended)

1. Open [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it e.g. `Bio Topic of the Day`, workspace **nycgradpostdocs**
3. **Incoming Webhooks** → On → **Add New Webhook to Workspace**
4. Choose **`#topic-of-day`** → Allow
5. Copy the webhook URL (`https://hooks.slack.com/services/...`)

## One-time GitHub secrets

In the GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
| --- | --- |
| `SLACK_WEBHOOK_URL` | the webhook URL from above |

(Optional bot-token mode instead of webhook: set `SLACK_BOT_TOKEN` and ideally `BIO_TOPIC_OF_DAY_CHANNEL_ID`. Do not set both unless you intend bot mode.)

## Turn it on

1. Push these files to `main` (if they are not already there)
2. GitHub → **Actions** → **Daily biology topic** → **Run workflow** (manual test)
3. Confirm a post appears in `#topic-of-day`
4. Leave the scheduled workflow enabled for daily posts

## Test locally

```bash
cd bio-topic-of-day
export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'
node scripts/post-daily-topic.mjs
```

## Adjust the clock

Cron is UTC. Edit `.github/workflows/daily-topic.yml`:

- `0 12 * * *` → 8:00 AM EDT / 7:00 AM EST
- `0 13 * * *` → 9:00 AM EDT / 8:00 AM EST

## Optional: BDK agent (interactive Slack bot)

The `bot/` folder is a Cursor BDK agent for mentions/DMs. Hosted BDK deploy
requires a Cursor Team, which this workspace is not using. You can ignore
`bot/` unless you later get team access or self-host `bdk serve`.
