#!/usr/bin/env node
/**
 * Post one opportunity to each opportunities-* Slack channel.
 *
 * Webhook secrets (recommended):
 *   SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH
 *   SLACK_WEBHOOK_URL_OPPORTUNITIES_VC
 *   SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA
 *   SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP
 *
 * Data files:
 *   data/opportunities/{biotech,vc,pharma,entrepreneurship}.json
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayIndex, easternDateKey, shouldPostNow } from "./lib/eastern.mjs";
import { validateApplyUrl } from "./lib/safe-url.mjs";
import { postViaWebhook } from "./lib/slack-webhook.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "opportunities");

const CHANNELS = [
  {
    id: "biotech",
    label: "biotech",
    slackChannel: "opportunities-biotech",
    file: "biotech.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_BIOTECH",
  },
  {
    id: "vc",
    label: "VC",
    slackChannel: "opportunities-vc",
    file: "vc.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_VC",
  },
  {
    id: "pharma",
    label: "pharma",
    slackChannel: "opportunities-pharma",
    file: "pharma.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA",
  },
  {
    id: "entrepreneurship",
    label: "entrepreneurship",
    slackChannel: "opportunities-entrepreneurship",
    file: "entrepreneurship.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP",
  },
];

function loadOpportunities(file) {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${file} must be a JSON array`);
  }
  return raw;
}

function pickOpportunity(items, date, channelId) {
  const usable = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.company !== "string" || item.company.trim() === "") continue;
    if (typeof item.title !== "string" || item.title.trim() === "") continue;
    if (typeof item.description !== "string" || item.description.trim() === "") {
      continue;
    }
    const url = validateApplyUrl(item.applyUrl);
    if (!url.ok) continue;
    usable.push({ item, applyUrl: url.href });
  }
  if (usable.length === 0) {
    throw new Error(
      `No safe/complete opportunities in ${channelId}. Check applyUrl (https only) and required fields.`,
    );
  }
  return usable[dayIndex(date, usable.length, channelId)];
}

function formatPostedBy(postedBy) {
  if (!postedBy || typeof postedBy !== "object") {
    return null;
  }
  const name = typeof postedBy.name === "string" ? postedBy.name.trim() : "";
  const contact =
    typeof postedBy.contact === "string" ? postedBy.contact.trim() : "";
  if (!name && !contact) {
    return null;
  }
  if (name && contact) {
    return `${name} (${contact})`;
  }
  return name || contact;
}

function formatMessage({ channel, date, company, title, description, applyUrl, postedBy }) {
  const lines = [
    `*Opportunity of the Day — ${channel.label} — ${date}*`,
    "",
    `*${company}*`,
    `*${title}*`,
    "",
    description.trim(),
    "",
    `*Apply:* <${applyUrl}|Open application / careers page>`,
  ];
  const by = formatPostedBy(postedBy);
  if (by) {
    lines.push("", `*Posted by:* ${by}`);
  }
  lines.push(
    "",
    "_Always verify the listing is still open and that the link matches the employer before applying._",
  );
  return lines.join("\n");
}

async function postChannel(channel, date) {
  const webhook = process.env[channel.webhookEnv]?.trim();
  if (!webhook) {
    return {
      channel: channel.slackChannel,
      posted: false,
      reason: `missing_secret:${channel.webhookEnv}`,
    };
  }

  const items = loadOpportunities(channel.file);
  const picked = pickOpportunity(items, date, channel.id);
  const text = formatMessage({
    channel,
    date,
    company: picked.item.company.trim(),
    title: picked.item.title.trim(),
    description: picked.item.description,
    applyUrl: picked.applyUrl,
    postedBy: picked.item.postedBy,
  });

  await postViaWebhook(webhook, text);
  return {
    channel: channel.slackChannel,
    posted: true,
    company: picked.item.company.trim(),
    title: picked.item.title.trim(),
    applyUrl: picked.applyUrl,
  };
}

async function main() {
  if (!shouldPostNow()) {
    console.log(
      JSON.stringify({
        posted: false,
        reason: "not_8am_eastern",
        easternDate: easternDateKey(),
      }),
    );
    return;
  }

  // Fail fast if data folder is missing files.
  const present = new Set(readdirSync(DATA_DIR));
  for (const channel of CHANNELS) {
    if (!present.has(channel.file)) {
      throw new Error(`Missing data file: data/opportunities/${channel.file}`);
    }
  }

  const date = easternDateKey();
  const results = [];
  const errors = [];

  for (const channel of CHANNELS) {
    try {
      results.push(await postChannel(channel, date));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ channel: channel.slackChannel, error: message });
      results.push({
        channel: channel.slackChannel,
        posted: false,
        reason: "error",
        error: message,
      });
    }
  }

  console.log(JSON.stringify({ date, results }, null, 2));

  const anyPosted = results.some((r) => r.posted);
  const missingOnly =
    errors.length === 0 && results.every((r) => !r.posted && String(r.reason).startsWith("missing_secret"));

  if (missingOnly) {
    throw new Error(
      "No opportunity webhook secrets set. Add SLACK_WEBHOOK_URL_OPPORTUNITIES_* secrets for each channel.",
    );
  }
  if (!anyPosted) {
    throw new Error("No opportunities were posted. See results above.");
  }
  if (errors.length > 0) {
    throw new Error(
      `Posted some channels, but ${errors.length} failed: ${errors.map((e) => e.channel).join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
