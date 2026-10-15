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
 * @returns {{ ok: true, href: string } | { ok: false, reason: string }}
 */
export function validateApplyUrl(raw) {
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
  return { ok: true, href: url.toString() };
}
