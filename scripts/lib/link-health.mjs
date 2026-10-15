/**
 * Live-check apply / listings links before posting.
 * Rejects clear dead links (404/410). Soft-fails network/403 as usable only
 * when allowUncertain is true; by default 2xx/3xx required.
 *
 * Careers listing boards often rate-limit or bot-wall scrapers (403/429);
 * use checkListingsUrl for those so a board wall does not block a good JD.
 */

async function probeUrl(href, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(href, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; NYCGradPostdocBot/1.0; +https://github.com/Nicholas-Bartelo/NYC-bio-grad-and-postdoc-slack)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    // Some career sites block HEAD or return false 404s on HEAD; retry GET.
    if (
      res.status === 405 ||
      res.status === 501 ||
      res.status === 403 ||
      res.status === 404 ||
      res.status === 429
    ) {
      res = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
      });
    }
    return { status: res.status, error: null };
  } catch (error) {
    return {
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkApplyUrl(href, { timeoutMs = 15000 } = {}) {
  const { status, error } = await probeUrl(href, { timeoutMs });
  if (error) {
    return { ok: false, status: 0, reason: error };
  }
  if (status === 404 || status === 410 || status === 451) {
    return { ok: false, status, reason: "dead_link" };
  }
  if (status >= 200 && status < 400) {
    return { ok: true, status };
  }
  if (status === 401 || status === 403) {
    return { ok: false, status, reason: "blocked_or_uncertain" };
  }
  return { ok: false, status, reason: `http_${status}` };
}

/** Listings boards: allow common bot walls / rate limits. */
export async function checkListingsUrl(href, { timeoutMs = 15000 } = {}) {
  const { status, error } = await probeUrl(href, { timeoutMs });
  if (error) {
    // Network blips on listing hubs should not block a healthy featured JD.
    return { ok: true, status: 0, reason: `network_uncertain:${error}` };
  }
  if (status === 404 || status === 410 || status === 451) {
    return { ok: false, status, reason: "dead_link" };
  }
  if (status >= 200 && status < 400) {
    return { ok: true, status };
  }
  if (status === 401 || status === 403 || status === 429) {
    return { ok: true, status, reason: "board_bot_wall_allowed" };
  }
  return { ok: false, status, reason: `http_${status}` };
}
