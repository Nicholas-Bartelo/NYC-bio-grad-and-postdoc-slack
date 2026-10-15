# Biology Topic of the Day

A [BDK](https://cursor.com/docs/bdk) Slack agent that posts one biology
discussion topic every day at **8:00 AM Eastern** into your
**Topic of the Day** channel. Topics can come from any field of biology.

## What it does

- Cron schedule `daily-topic` fires at `0 12 * * *` UTC (8:00 AM EDT /
  7:00 AM EST — adjust the cron in `bot/schedules/daily-topic.md` if you
  need a different timezone).
- The agent picks a fresh topic, avoids recent repeats, and posts to Slack
  via `post_topic_of_day`.
- Mentions/DMs work too: ask it to “post today’s topic” or suggest one.

## Setup

```bash
npm install
npx @cursor/bdk login
npx @cursor/bdk slack create --dir . --name "Bio Topic of the Day"
```

1. Complete the Slack wizard (same Cursor account in the browser).
2. Invite the bot to `#topic-of-the-day` (or your channel).
3. Set the channel in `.env.local` (see `.env.example`):

```bash
BIO_TOPIC_OF_DAY_CHANNEL_ID=C0123456789   # preferred
# or
BIO_TOPIC_OF_DAY_CHANNEL_NAME=topic-of-the-day
```

4. Confirm Slack credentials:

```bash
npx @cursor/bdk slack doctor --prefix BIO_TOPIC_OF_DAY
```

## Local run

```bash
npx @cursor/bdk serve --dir . --dev
```

Schedules do **not** auto-fire in `--dev`. Dispatch by hand:

```bash
curl -X POST http://127.0.0.1:3000/bio-topic-of-day/v1/dev/schedules/daily-topic
```

Or mention the bot: “Post today’s biology Topic of the Day.”

## Deploy (so 8 AM runs automatically)

```bash
npx @cursor/bdk deploy --dir .
```

Hosted schedules come from the deployed release. After deploy, the daily
cron posts without a local `serve` process.

## Checks

```bash
npx @cursor/bdk validate --dir .
npx @cursor/bdk info --dir . --json
npm run check
npx @cursor/bdk eval --dir . --list
# needs a Cursor API key:
npx @cursor/bdk eval --dir . --tag smoke
```

## Layout

| Path | Role |
| --- | --- |
| `bot/instructions.md` | Agent prompt |
| `bot/schedules/daily-topic.md` | 8 AM Eastern cron |
| `bot/tools/post_topic_of_day.ts` | Slack post + dedupe |
| `bot/tools/list_recent_topics.ts` | Recent topic memory |
| `bot/channels/slack.ts` | Slack channel pack |
| `evals/daily-topic.eval.ts` | Smoke eval |
