/**
 * Live-check apply links before posting.
 * Rejects clear dead links (404/410). Soft-fails network/403 as usable only
 * when allowUncertain is true; by default 2xx/3xx required.
 */

export async function checkApplyUrl(href, { timeoutMs = 15000 } = {}) {
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
      res.status === 404
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
    const status = res.status;
    if (status === 404 || status === 410 || status === 451) {
      return { ok: false, status, reason: "dead_link" };
    }
    if (status >= 200 && status < 400) {
      return { ok: true, status };
    }
    // Bot walls (401/403) are common on careers sites; treat as uncertain.
    if (status === 401 || status === 403) {
      return { ok: false, status, reason: "blocked_or_uncertain" };
    }
    return { ok: false, status, reason: `http_${status}` };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
