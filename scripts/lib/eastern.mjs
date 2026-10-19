/** America/New_York date/hour helpers for scheduled posts. */

export function easternDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function easternHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return Number(hour);
}

/**
 * Post eligibility for a run. Dedup (already-posted-today) is separate.
 * - repository_dispatch / schedule / Actions CI: always attempt
 * - workflow_dispatch: always attempt
 * - local ad-hoc: Eastern hour 8–9 unless FORCE_POST
 */
export function shouldPostNow() {
  if (process.env.FORCE_POST === "1") {
    return true;
  }
  const event = process.env.GITHUB_EVENT_NAME || "";
  if (
    event === "workflow_dispatch" ||
    event === "schedule" ||
    event === "repository_dispatch"
  ) {
    return true;
  }
  if (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true") {
    return true;
  }
  const hour = easternHour();
  return hour === 8 || hour === 9;
}

/** Only explicit force flags may repost the same Eastern day. */
export function allowRepostToday() {
  if (process.env.FORCE_POST === "1") {
    return true;
  }
  const force = (process.env.FORCE_REPOST || "").toLowerCase();
  return force === "true" || force === "1";
}

export function dayIndex(dateKey, modulo, salt = "") {
  const input = `${salt}:${dateKey}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}
