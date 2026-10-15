import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Persistent "already posted" memory for opportunities.
 * Stored in-repo so GitHub Actions can commit updates after each run.
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
    return { keys: [], lastPostedDate: null, entries: [] };
  }
  const keys = Array.isArray(entry.keys)
    ? entry.keys.filter((k) => typeof k === "string")
    : [];
  const entries = Array.isArray(entry.entries) ? entry.entries : [];
  const lastPostedDate =
    typeof entry.lastPostedDate === "string" ? entry.lastPostedDate : null;
  return { keys, lastPostedDate, entries };
}

export function recordPosted(history, channelId, { key, company, position, applyUrl, date }) {
  const current = getChannelHistory(history, channelId);
  const keys = current.keys.includes(key) ? current.keys : [...current.keys, key];
  const entries = [
    ...current.entries,
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
  };
  return history;
}

export function resetChannelKeys(history, channelId) {
  const current = getChannelHistory(history, channelId);
  history.channels[channelId] = {
    keys: [],
    lastPostedDate: current.lastPostedDate,
    entries: current.entries,
    cycleResetAt: new Date().toISOString(),
  };
  return history;
}

export function savePostedHistory(path, history) {
  const payload = `${JSON.stringify(history, null, 2)}\n`;
  writeFileSync(path, payload, "utf8");
}
