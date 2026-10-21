import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Persistent "already posted" memory for opportunities.
 * Stored in-repo so GitHub Actions can commit updates after each run.
 *
 * Used by schedule, workflow_dispatch, and repository_dispatch (cron-job.org)
 * — the trigger does not change memory rules.
 */

export function opportunityKey({ company, position, applyUrl }) {
  return `${company.trim()}||${position.trim()}||${applyUrl.trim()}`;
}

export function loadPostedHistory(path) {
  if (!existsSync(path)) {
    return { version: 1, channels: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw || typeof raw !== "object") {
      return { version: 1, channels: {} };
    }
    const channels =
      raw.channels && typeof raw.channels === "object" ? raw.channels : {};
    return { version: 1, channels };
  } catch {
    return { version: 1, channels: {} };
  }
}

export function getChannelHistory(history, channelId) {
  const entry = history.channels[channelId];
  if (!entry || typeof entry !== "object") {
    return {
      keys: [],
      lastPostedDate: null,
      entries: [],
      cycleResetAt: null,
    };
  }

  const entries = Array.isArray(entry.entries) ? entry.entries : [];
  const keysFromField = Array.isArray(entry.keys)
    ? entry.keys.filter((k) => typeof k === "string")
    : [];
  const cycleResetAt =
    typeof entry.cycleResetAt === "string" ? entry.cycleResetAt : null;
  const uniqueEntryKeys = [
    ...new Set(
      entries
        .map((e) => (typeof e?.key === "string" ? e.key : null))
        .filter(Boolean),
    ),
  ];

  // Heal wiped `keys` when there was no intentional cycle reset.
  // (A bug previously replaced keys with only the newest post.)
  let keys = keysFromField;
  if (!cycleResetAt && uniqueEntryKeys.length > keysFromField.length) {
    keys = uniqueEntryKeys;
  }

  const lastPostedDate =
    typeof entry.lastPostedDate === "string" ? entry.lastPostedDate : null;
  return { keys, lastPostedDate, entries, cycleResetAt };
}

export function recordPosted(
  history,
  channelId,
  { key, company, position, applyUrl, date },
) {
  const stored = history.channels[channelId] || {};
  const storedKeys = Array.isArray(stored.keys)
    ? stored.keys.filter((k) => typeof k === "string")
    : [];
  const storedEntries = Array.isArray(stored.entries) ? stored.entries : [];
  const keys = storedKeys.includes(key) ? storedKeys : [...storedKeys, key];
  const entries = [
    ...storedEntries,
    {
      key,
      company,
      position,
      applyUrl,
      postedAt: new Date().toISOString(),
      date,
    },
  ].slice(-200);

  history.channels[channelId] = {
    keys,
    lastPostedDate: date,
    entries,
    // Preserve intentional cycle-reset marker (do not drop on each post).
    cycleResetAt:
      typeof stored.cycleResetAt === "string" ? stored.cycleResetAt : null,
  };
  return history;
}

export function resetChannelKeys(history, channelId) {
  const stored = history.channels[channelId] || {};
  const entries = Array.isArray(stored.entries) ? stored.entries : [];
  const lastPostedDate =
    typeof stored.lastPostedDate === "string" ? stored.lastPostedDate : null;
  history.channels[channelId] = {
    keys: [],
    lastPostedDate,
    entries,
    cycleResetAt: new Date().toISOString(),
  };
  return history;
}

/** Rebuild keys from the full audit log (blocks all previously sent roles). */
export function healChannelKeysFromEntries(history, channelId) {
  const stored = history.channels[channelId] || {};
  const entries = Array.isArray(stored.entries) ? stored.entries : [];
  const keys = [
    ...new Set(
      entries
        .map((e) => (typeof e?.key === "string" ? e.key : null))
        .filter(Boolean),
    ),
  ];
  history.channels[channelId] = {
    keys,
    lastPostedDate:
      typeof stored.lastPostedDate === "string" ? stored.lastPostedDate : null,
    entries,
    cycleResetAt: null,
  };
  return history;
}

export function savePostedHistory(path, history) {
  const payload = `${JSON.stringify(history, null, 2)}\n`;
  writeFileSync(path, payload, "utf8");
}
