#!/usr/bin/env node
/**
 * Post today's biology Topic of the Day to Slack.
 * Designed for GitHub Actions.
 *
 * Auth (either works):
 *   SLACK_WEBHOOK_URL          Incoming webhook for #topic-of-day (simplest)
 *   SLACK_BOT_TOKEN + channel  Bot token with chat:write
 *
 * Channel (bot-token mode):
 *   BIO_TOPIC_OF_DAY_CHANNEL_ID   preferred
 *   BIO_TOPIC_OF_DAY_CHANNEL_NAME default: topic-of-day
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayIndex, easternDateKey, easternHour, shouldPostNow } from "./lib/eastern.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOPIC_HISTORY_PATH = join(ROOT, "data", "topic-last-posted.json");
const CHANNEL_ID_RE = /^[CG][A-Z0-9]+$/i;

function allowRepostToday() {
  return (
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ||
    process.env.FORCE_POST === "1"
  );
}

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
    `*${topic.title}*`,
    `_${topic.field}_`,
    "",
    topic.blurb.trim(),
    "",
    `*Discussion prompt:* ${topic.prompt.trim()}`,
  ].join("\n");
}

async function slackApi(token, method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`${method} failed: ${json.error ?? res.status}`);
  }
  return json;
}

async function resolveChannelId(token, channelId, channelName) {
  if (channelId && CHANNEL_ID_RE.test(channelId)) {
    return channelId;
  }
  const name = (channelName || "topic-of-day").replace(/^#/, "");
  if (CHANNEL_ID_RE.test(name)) {
    return name;
  }
  let cursor;
  for (let page = 0; page < 8; page++) {
    const listed = await slackApi(token, "users.conversations", {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    const match = (listed.channels ?? []).find((c) => c.name === name);
    if (match?.id) {
      return match.id;
    }
    cursor = listed.response_metadata?.next_cursor;
    if (!cursor) {
      break;
    }
  }
  throw new Error(
    `Could not find #${name}. Invite the bot to the channel or set BIO_TOPIC_OF_DAY_CHANNEL_ID.`,
  );
}

async function postViaWebhook(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text, mrkdwn: true }),
  });
  const body = await res.text();
  if (!res.ok || body !== "ok") {
    throw new Error(`Webhook post failed: ${res.status} ${body}`);
  }
}

async function postViaBot(token, text) {
  const channelId = await resolveChannelId(
    token,
    process.env.BIO_TOPIC_OF_DAY_CHANNEL_ID?.trim(),
    process.env.BIO_TOPIC_OF_DAY_CHANNEL_NAME?.trim(),
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

  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  const botToken =
    process.env.SLACK_BOT_TOKEN?.trim() ||
    process.env.BIO_TOPIC_OF_DAY_SLACK_BOT_TOKEN?.trim();

  if (webhook) {
    await postViaWebhook(webhook, text);
    saveTopicHistory(date, topic.title);
    console.log(
      JSON.stringify({
        posted: true,
        mode: "webhook",
        date,
        title: topic.title,
        field: topic.field,
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
    "Set SLACK_WEBHOOK_URL (recommended) or SLACK_BOT_TOKEN / BIO_TOPIC_OF_DAY_SLACK_BOT_TOKEN",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
