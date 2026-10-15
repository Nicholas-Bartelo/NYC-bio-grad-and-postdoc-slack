#!/usr/bin/env node
/**
 * Post opportunities to each opportunities-* Slack channel.
 *
 * Each entry features one specific role (responsibilities + qualifications)
 * and also links a careers/listings page clearly labeled as a job board
 * (many roles — not a single job).
 *
 * Most channels post 1 role/day. The spatial channel posts 2/day.
 *
 * Never repeats an opportunity until every usable listing in that channel
 * has been posted once; then the channel history resets for a new cycle.
 * History is stored in data/opportunities/posted-history.json.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayIndex, easternDateKey, shouldPostNow } from "./lib/eastern.mjs";
import { checkApplyUrl, checkListingsUrl } from "./lib/link-health.mjs";
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
    postsPerDay: 1,
  },
  {
    id: "vc",
    label: "VC",
    slackChannel: "opportunities-vc",
    file: "vc.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_VC",
    postsPerDay: 1,
  },
  {
    id: "pharma",
    label: "pharma",
    slackChannel: "opportunities-pharma",
    file: "pharma.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_PHARMA",
    postsPerDay: 1,
  },
  {
    id: "entrepreneurship",
    label: "entrepreneurship",
    slackChannel: "opportunities-entrepreneurship",
    file: "entrepreneurship.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_ENTREPRENEURSHIP",
    postsPerDay: 1,
  },
  {
    id: "spatial",
    label: "spatial omics",
    slackChannel: "opportunities-spatial",
    file: "spatial.json",
    webhookEnv: "SLACK_WEBHOOK_URL_OPPORTUNITIES_SPATIAL",
    postsPerDay: 2,
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
  const companyType =
    typeof item.companyType === "string" ? item.companyType.trim() : "";
  const mission = typeof item.mission === "string" ? item.mission.trim() : "";
  if (!company || !companyType || !mission) return null;

  const featured = item.featured && typeof item.featured === "object" ? item.featured : null;
  const position = (
    typeof featured?.position === "string"
      ? featured.position
      : typeof item.position === "string"
        ? item.position
        : typeof item.title === "string"
          ? item.title
          : ""
  ).trim();
  const description = (
    typeof featured?.description === "string"
      ? featured.description
      : typeof item.description === "string"
        ? item.description
        : ""
  ).trim();
  const responsibilities = (
    typeof featured?.responsibilities === "string"
      ? featured.responsibilities
      : ""
  ).trim();
  const qualifications = (
    typeof featured?.qualifications === "string" ? featured.qualifications : ""
  ).trim();
  const location =
    typeof item.location === "string"
      ? item.location.trim()
      : typeof featured?.location === "string"
        ? featured.location.trim()
        : "";
  const spatialFocus =
    typeof item.spatialFocus === "string"
      ? item.spatialFocus.trim()
      : typeof featured?.spatialFocus === "string"
        ? featured.spatialFocus.trim()
        : "";
  const featuredApplyRaw =
    typeof featured?.applyUrl === "string"
      ? featured.applyUrl
      : typeof item.applyUrl === "string"
        ? item.applyUrl
        : "";
  const listingsRaw =
    typeof item.listingsUrl === "string" ? item.listingsUrl : "";

  if (!position || !description || !responsibilities || !qualifications) {
    return null;
  }
  if (!featuredApplyRaw || !listingsRaw) return null;

  const featuredUrl = validateApplyUrl(featuredApplyRaw);
  const listingsUrl = validateApplyUrl(listingsRaw);
  if (!featuredUrl.ok || !listingsUrl.ok) return null;

  // Featured JD must be a specific posting, not the same careers board URL.
  if (featuredUrl.href === listingsUrl.href) return null;

  const normalized = {
    company,
    companyType,
    mission,
    position,
    description,
    responsibilities,
    qualifications,
    location,
    spatialFocus,
    applyUrl: featuredUrl.href,
    listingsUrl: listingsUrl.href,
    postedBy: item.postedBy,
  };
  return { ...normalized, key: opportunityKey(normalized) };
}

async function pickHealthyOpportunity(
  items,
  date,
  channelId,
  history,
  { excludeKeys = [] } = {},
) {
  const candidates = items
    .map(normalizeItem)
    .filter(Boolean)
    .filter((c) => !excludeKeys.includes(c.key));
  if (candidates.length === 0) {
    throw new Error(
      `No complete opportunities in ${channelId}. Need company, companyType, mission, listingsUrl, and featured.position/description/responsibilities/qualifications/applyUrl (applyUrl must differ from listingsUrl).`,
    );
  }

  let channelHistory = getChannelHistory(history, channelId);
  let unused = candidates.filter((c) => !channelHistory.keys.includes(c.key));
  let cycleReset = false;

  if (unused.length === 0) {
    resetChannelKeys(history, channelId);
    channelHistory = getChannelHistory(history, channelId);
    unused = candidates;
    cycleReset = true;
  }

  const start = dayIndex(
    date,
    unused.length,
    `${channelId}:unused:${excludeKeys.length}`,
  );
  const skipped = [];
  for (let offset = 0; offset < unused.length; offset++) {
    const candidate = unused[(start + offset) % unused.length];
    const featuredHealth = await checkApplyUrl(candidate.applyUrl);
    if (!featuredHealth.ok) {
      skipped.push({
        company: candidate.company,
        position: candidate.position,
        applyUrl: candidate.applyUrl,
        status: featuredHealth.status,
        reason: featuredHealth.reason,
      });
      continue;
    }

    const listingsHealth = await checkListingsUrl(candidate.listingsUrl);
    if (!listingsHealth.ok) {
      skipped.push({
        company: candidate.company,
        position: candidate.position,
        applyUrl: candidate.listingsUrl,
        status: listingsHealth.status,
        reason: `listings_${listingsHealth.reason}`,
      });
      continue;
    }

    return {
      ...candidate,
      linkStatus: featuredHealth.status,
      listingsStatus: listingsHealth.status,
      skipped,
      cycleReset,
    };
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

function formatMessage(picked, channel, date, { index, total } = {}) {
  const title =
    total && total > 1
      ? `*Opportunity of the Day (${index}/${total}) — ${channel.label} — ${date}*`
      : `*Opportunity of the Day — ${channel.label} — ${date}*`;

  const lines = [
    title,
    "",
    `*Company:* ${picked.company}`,
    `*Company type:* ${picked.companyType}`,
    `*Featured position:* ${picked.position}`,
  ];

  if (picked.location) {
    lines.push(`*Location:* ${picked.location}`);
  }
  if (picked.spatialFocus) {
    lines.push(`*Spatial focus:* ${picked.spatialFocus}`);
  }

  lines.push(
    "",
    `*About the company:* ${picked.companyType}. Scientific goal: ${picked.mission}`,
    "",
    `*What we’re sharing:* ${picked.description}`,
    "",
    `*Responsibilities (this role):* ${picked.responsibilities}`,
    "",
    `*Qualifications (this role):* ${picked.qualifications}`,
    "",
    `*Apply to this specific role:* <${picked.applyUrl}|${picked.position}>`,
    `*Browse all open positions (listings page — many roles, not one job):* <${picked.listingsUrl}|${picked.company} careers / open roles>`,
  );

  const by = formatPostedBy(picked.postedBy);
  if (by) {
    lines.push("", `*Posted by:* ${by}`);
  }
  lines.push(
    "",
    "_Links were checked before posting, but openings change — confirm this specific role is still active before you apply._",
  );
  return lines.join("\n");
}

function allowRepostToday() {
  // Scheduled runs stay once-per-day. Manual Run workflow / FORCE_POST can
  // post again the same Eastern day (useful after format changes or testing).
  return (
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ||
    process.env.FORCE_POST === "1"
  );
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
  if (channelHistory.lastPostedDate === date && !allowRepostToday()) {
    return {
      channel: channel.slackChannel,
      posted: false,
      reason: "already_posted_today",
      lastPostedDate: date,
    };
  }

  const postsPerDay = Number(channel.postsPerDay) > 0 ? Number(channel.postsPerDay) : 1;
  const items = loadOpportunities(channel.file);
  const posted = [];
  const excludeKeys = [];
  let cycleReset = false;
  let skippedDeadLinks = 0;

  for (let i = 0; i < postsPerDay; i++) {
    const picked = await pickHealthyOpportunity(items, date, channel.id, history, {
      excludeKeys,
    });
    const text = formatMessage(picked, channel, date, {
      index: i + 1,
      total: postsPerDay,
    });

    await postViaWebhook(webhook, text);
    recordPosted(history, channel.id, {
      key: picked.key,
      company: picked.company,
      position: picked.position,
      applyUrl: picked.applyUrl,
      date,
    });

    excludeKeys.push(picked.key);
    cycleReset = cycleReset || picked.cycleReset;
    skippedDeadLinks += picked.skipped.length;
    posted.push({
      company: picked.company,
      position: picked.position,
      applyUrl: picked.applyUrl,
      listingsUrl: picked.listingsUrl,
      location: picked.location || null,
      spatialFocus: picked.spatialFocus || null,
      linkStatus: picked.linkStatus,
    });
  }

  return {
    channel: channel.slackChannel,
    posted: true,
    postsPerDay,
    opportunities: posted,
    skippedDeadLinks,
    cycleReset,
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

  // Don't fail the whole job solely because the new spatial secret isn't set yet.
  const nonSpatialMissingOnly =
    errors.length === 0 &&
    results
      .filter((r) => r.channel !== "opportunities-spatial")
      .every((r) => !r.posted && String(r.reason).startsWith("missing_secret")) &&
    results.some((r) => r.channel === "opportunities-spatial");

  if (missingOnly && !nonSpatialMissingOnly) {
    throw new Error(
      "No opportunity webhook secrets set. Add SLACK_WEBHOOK_URL_OPPORTUNITIES_* secrets for each channel.",
    );
  }
  if (!anyPosted && !results.some((r) => r.reason === "already_posted_today")) {
    // Allow success when only spatial is missing its secret and others already posted today.
    const onlySpatialMissing =
      results.every(
        (r) =>
          r.reason === "already_posted_today" ||
          (r.channel === "opportunities-spatial" &&
            String(r.reason).startsWith("missing_secret")),
      ) &&
      results.some((r) => r.channel === "opportunities-spatial");
    if (!onlySpatialMissing) {
      throw new Error("No opportunities were posted. See results above.");
    }
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
