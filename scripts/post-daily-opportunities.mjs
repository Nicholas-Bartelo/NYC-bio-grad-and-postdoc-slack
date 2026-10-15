#!/usr/bin/env node
/**
 * Post one opportunity to each opportunities-* Slack channel.
 *
 * Never repeats an opportunity until every usable listing in that channel
 * has been posted once; then the channel history resets for a new cycle.
 * History is stored in data/opportunities/posted-history.json.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayIndex, easternDateKey, shouldPostNow } from "./lib/eastern.mjs";
import { checkApplyUrl } from "./lib/link-health.mjs";
import {
  getChannelHistory,
  loadPostedHistory,
  opportunityKey,
  recordPosted,
  resetChannelKeys,
  savePostedHistory,
} from "./lib/posted-history.mjs";
import { validateApplyUrl } from "./lib/safe-url.mjs";
import { postViaWebhook } from "./lib/slack-webhook.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "opportunities");
const HISTORY_PATH = join(DATA_DIR, "posted-history.json");

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

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  const company = typeof item.company === "string" ? item.company.trim() : "";
  const mission = typeof item.mission === "string" ? item.mission.trim() : "";
  const position = (
    typeof item.position === "string"
      ? item.position
      : typeof item.title === "string"
        ? item.title
        : ""
  ).trim();
  const description =
    typeof item.description === "string" ? item.description.trim() : "";
  if (!company || !mission || !position || !description) return null;
  const url = validateApplyUrl(item.applyUrl);
  if (!url.ok) return null;
  const normalized = {
    company,
    mission,
    position,
    description,
    applyUrl: url.href,
    postedBy: item.postedBy,
  };
  return { ...normalized, key: opportunityKey(normalized) };
}

async function pickHealthyOpportunity(items, date, channelId, history) {
  const candidates = items.map(normalizeItem).filter(Boolean);
  if (candidates.length === 0) {
    throw new Error(
      `No complete opportunities in ${channelId}. Need company, mission, position, description, https applyUrl.`,
    );
  }

  let channelHistory = getChannelHistory(history, channelId);
  let unused = candidates.filter((c) => !channelHistory.keys.includes(c.key));
  let cycleReset = false;

  // If everything has been used, start a new cycle.
  if (unused.length === 0) {
    resetChannelKeys(history, channelId);
    channelHistory = getChannelHistory(history, channelId);
    unused = candidates;
    cycleReset = true;
  }

  const start = dayIndex(date, unused.length, `${channelId}:unused`);
  const skipped = [];
  for (let offset = 0; offset < unused.length; offset++) {
    const candidate = unused[(start + offset) % unused.length];
    const health = await checkApplyUrl(candidate.applyUrl);
    if (health.ok) {
      return { ...candidate, linkStatus: health.status, skipped, cycleReset };
    }
    skipped.push({
      company: candidate.company,
      position: candidate.position,
      applyUrl: candidate.applyUrl,
      status: health.status,
      reason: health.reason,
    });
  }

  throw new Error(
    `All unused opportunity links failed health checks for ${channelId}. Skipped: ${JSON.stringify(skipped)}`,
  );
}

function formatPostedBy(postedBy) {
  if (!postedBy || typeof postedBy !== "object") return null;
  const name = typeof postedBy.name === "string" ? postedBy.name.trim() : "";
  const contact =
    typeof postedBy.contact === "string" ? postedBy.contact.trim() : "";
  if (!name && !contact) return null;
  if (name && contact) return `${name} (${contact})`;
  return name || contact;
}

function formatMessage({ channel, date, company, mission, position, description, applyUrl, postedBy }) {
  const lines = [
    `*Opportunity of the Day — ${channel.label} — ${date}*`,
    "",
    `*Company:* ${company}`,
    `*Position:* ${position}`,
    "",
    `*About the company:* ${mission}`,
    "",
    `*What we’re sharing:* ${description}`,
    "",
    `*Apply:* <${applyUrl}|${position}>`,
  ];
  const by = formatPostedBy(postedBy);
  if (by) {
    lines.push("", `*Posted by:* ${by}`);
  }
  lines.push(
    "",
    "_Link was checked before posting, but openings change — confirm the listing is still active before you apply._",
  );
  return lines.join("\n");
}

async function postChannel(channel, date, history) {
  const webhook = process.env[channel.webhookEnv]?.trim();
  if (!webhook) {
    return {
      channel: channel.slackChannel,
      posted: false,
      reason: `missing_secret:${channel.webhookEnv}`,
    };
  }

  const channelHistory = getChannelHistory(history, channel.id);
  if (channelHistory.lastPostedDate === date) {
    return {
      channel: channel.slackChannel,
      posted: false,
      reason: "already_posted_today",
      lastPostedDate: date,
    };
  }

  const items = loadOpportunities(channel.file);
  const picked = await pickHealthyOpportunity(items, date, channel.id, history);
  const text = formatMessage({
    channel,
    date,
    company: picked.company,
    mission: picked.mission,
    position: picked.position,
    description: picked.description,
    applyUrl: picked.applyUrl,
    postedBy: picked.postedBy,
  });

  await postViaWebhook(webhook, text);
  recordPosted(history, channel.id, {
    key: picked.key,
    company: picked.company,
    position: picked.position,
    applyUrl: picked.applyUrl,
    date,
  });

  return {
    channel: channel.slackChannel,
    posted: true,
    company: picked.company,
    position: picked.position,
    applyUrl: picked.applyUrl,
    linkStatus: picked.linkStatus,
    skippedDeadLinks: picked.skipped.length,
    cycleReset: picked.cycleReset,
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

  const present = new Set(readdirSync(DATA_DIR));
  for (const channel of CHANNELS) {
    if (!present.has(channel.file)) {
      throw new Error(`Missing data file: data/opportunities/${channel.file}`);
    }
  }

  const date = easternDateKey();
  const history = loadPostedHistory(HISTORY_PATH);
  const results = [];
  const errors = [];

  for (const channel of CHANNELS) {
    try {
      results.push(await postChannel(channel, date, history));
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

  const anyPosted = results.some((r) => r.posted);
  if (anyPosted) {
    savePostedHistory(HISTORY_PATH, history);
  }

  console.log(JSON.stringify({ date, results }, null, 2));

  const missingOnly =
    errors.length === 0 &&
    results.every((r) => !r.posted && String(r.reason).startsWith("missing_secret"));

  if (missingOnly) {
    throw new Error(
      "No opportunity webhook secrets set. Add SLACK_WEBHOOK_URL_OPPORTUNITIES_* secrets for each channel.",
    );
  }
  if (!anyPosted && !results.some((r) => r.reason === "already_posted_today")) {
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
