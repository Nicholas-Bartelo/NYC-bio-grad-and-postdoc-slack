#!/usr/bin/env node
/**
 * Post today's biology Topic of the Day to Slack.
 * Designed for GitHub Actions.
 *
 * Auth preference:
 *   1. SLACK_USER_TOKEN (xoxp-…) — posts as you; editable in Slack UI
 *   2. SLACK_WEBHOOK_URL — Incoming Webhook (app message; not editable)
 *   3. SLACK_BOT_TOKEN — bot post (not editable by you)
 *
 * Channel (user/bot token mode):
 *   SLACK_CHANNEL_ID_TOPIC_OF_DAY or BIO_TOPIC_OF_DAY_CHANNEL_ID
 *   BIO_TOPIC_OF_DAY_CHANNEL_NAME default: topic-of-day
 *
 * See docs/USER_TOKEN_POSTING.md
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowRepostToday,
  dayIndex,
  easternDateKey,
  easternHour,
  shouldPostNow,
} from "./lib/eastern.mjs";
import { postToSlack, slackApi, resolveChannelId } from "./lib/slack-post.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOPIC_HISTORY_PATH = join(ROOT, "data", "topic-last-posted.json");

function loadTopicHistory() {
  if (!existsSync(TOPIC_HISTORY_PATH)) {
    return { lastPostedDate: null, title: null };
  }
  try {
    const raw = JSON.parse(readFileSync(TOPIC_HISTORY_PATH, "utf8"));
    return {
      lastPostedDate:
        typeof raw?.lastPostedDate === "string" ? raw.lastPostedDate : null,
      title: typeof raw?.title === "string" ? raw.title : null,
    };
  } catch {
    return { lastPostedDate: null, title: null };
  }
}

function saveTopicHistory(date, title) {
  writeFileSync(
    TOPIC_HISTORY_PATH,
    `${JSON.stringify(
      {
        lastPostedDate: date,
        title,
        postedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function formatTopicMessage(topic, date) {
  return [
    `*Topic of the Day — ${date}*`,
    "",
    `*${topic.title.trim()}*`,
    `_${topic.field.trim()}_`,
    "",
    topic.blurb.trim(),
    "",
    `*Discussion prompt:* ${topic.prompt.trim()}`,
  ].join("\n");
}

async function postViaBot(token, text) {
  const channelId = await resolveChannelId(
    token,
    process.env.SLACK_CHANNEL_ID_TOPIC_OF_DAY?.trim() ||
      process.env.BIO_TOPIC_OF_DAY_CHANNEL_ID?.trim(),
    process.env.BIO_TOPIC_OF_DAY_CHANNEL_NAME?.trim() || "topic-of-day",
  );
  const result = await slackApi(token, "chat.postMessage", {
    channel: channelId,
    text,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
  });
  return { channelId, ts: result.ts };
}

async function main() {
  if (!shouldPostNow()) {
    console.log(
      JSON.stringify({
        posted: false,
        reason: "outside_morning_window",
        easternHour: easternHour(),
        easternDate: easternDateKey(),
      }),
    );
    return;
  }

  const date = easternDateKey();
  const history = loadTopicHistory();
  if (history.lastPostedDate === date && !allowRepostToday()) {
    console.log(
      JSON.stringify({
        posted: false,
        reason: "already_posted_today",
        easternDate: date,
        title: history.title,
      }),
    );
    return;
  }

  const topics = JSON.parse(
    readFileSync(join(ROOT, "data", "topics.json"), "utf8"),
  );
  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error("data/topics.json is empty");
  }

  const topic = topics[dayIndex(date, topics.length)];
  const text = formatTopicMessage(topic, date);

  const userToken = process.env.SLACK_USER_TOKEN?.trim();
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  const botToken =
    process.env.SLACK_BOT_TOKEN?.trim() ||
    process.env.BIO_TOPIC_OF_DAY_SLACK_BOT_TOKEN?.trim();

  if (userToken || webhook) {
    // Always pass both so user-token failures can fall back to the webhook.
    const meta = await postToSlack(text, {
      userToken,
      webhookUrl: webhook,
      channelId:
        process.env.SLACK_CHANNEL_ID_TOPIC_OF_DAY?.trim() ||
        process.env.BIO_TOPIC_OF_DAY_CHANNEL_ID?.trim(),
      channelName:
        process.env.BIO_TOPIC_OF_DAY_CHANNEL_NAME?.trim() || "topic-of-day",
    });
    saveTopicHistory(date, topic.title);
    console.log(
      JSON.stringify({
        posted: true,
        mode: meta.mode,
        date,
        title: topic.title,
        field: topic.field,
        channelId: meta.channelId,
        ts: meta.ts,
      }),
    );
    return;
  }

  if (botToken) {
    const meta = await postViaBot(botToken, text);
    saveTopicHistory(date, topic.title);
    console.log(
      JSON.stringify({
        posted: true,
        mode: "bot",
        date,
        title: topic.title,
        field: topic.field,
        ...meta,
      }),
    );
    return;
  }

  throw new Error(
    "Set SLACK_USER_TOKEN (recommended — editable posts) or SLACK_WEBHOOK_URL. See docs/USER_TOKEN_POSTING.md",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
