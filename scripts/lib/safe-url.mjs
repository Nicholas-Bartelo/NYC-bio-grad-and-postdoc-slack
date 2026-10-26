/** Validate apply links before posting to Slack. */

const BLOCKED_HOST_SUFFIXES = [
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
];

/**
 * Reject career-board homepages used as if they were a single job JD.
 * Featured applyUrl must point at one specific role.
 */
export function isJobBoardHomepage(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
    // Accept only /{board}/jobs/{numericId} (optional trailing junk).
    const jobsIdx = parts.indexOf("jobs");
    if (jobsIdx >= 1 && parts[jobsIdx + 1] && /^\d+$/.test(parts[jobsIdx + 1])) {
      return false;
    }
    return true;
  }

  if (host.endsWith("ashbyhq.com") || host === "jobs.ashbyhq.com") {
    // Accept /{org}/{job-posting-slug}; reject /{org} alone.
    if (parts.length < 2) return true;
    return false;
  }

  // Generic company careers hubs with no job id/slug depth.
  const boardish = new Set([
    "careers",
    "jobs",
    "join",
    "openings",
    "open-positions",
    "opportunities",
    "about",
  ]);
  if (parts.length === 0) return true;
  if (parts.length === 1 && boardish.has(parts[0])) return true;
  if (
    parts.length === 2 &&
    boardish.has(parts[0]) &&
    ["jobs", "openings", "open-positions", "opportunities"].includes(parts[1])
  ) {
    return true;
  }

  return false;
}

/**
 * Basic https URL checks (used for careers listing hubs and apply links).
 * @returns {{ ok: true, href: string, url: URL } | { ok: false, reason: string }}
 */
export function validateHttpsUrl(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "missing_url" };
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "https_required" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) {
    return { ok: false, reason: "local_host" };
  }
  if (BLOCKED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { ok: false, reason: "blocked_shortener" };
  }
  return { ok: true, href: url.toString(), url };
}

/**
 * Featured apply link: must be a specific job posting, not a board homepage.
 * @returns {{ ok: true, href: string } | { ok: false, reason: string }}
 */
export function validateApplyUrl(raw) {
  const base = validateHttpsUrl(raw);
  if (!base.ok) return base;
  if (isJobBoardHomepage(base.url)) {
    return { ok: false, reason: "board_homepage_not_specific_job" };
  }
  return { ok: true, href: base.href };
}
