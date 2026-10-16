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
 * Manual Run workflow / FORCE_POST always posts.
 * Scheduled runs post during Eastern hour 8, and also hour 9 as a catch-up
 * window when GitHub delays the cron past 8:59.
 * Dedup (already-posted-today) prevents double posts across retries.
 */
export function shouldPostNow() {
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    return true;
  }
  if (process.env.FORCE_POST === "1") {
    return true;
  }
  const hour = easternHour();
  return hour === 8 || hour === 9;
}

export function dayIndex(dateKey, modulo, salt = "") {
  const input = `${salt}:${dateKey}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}
