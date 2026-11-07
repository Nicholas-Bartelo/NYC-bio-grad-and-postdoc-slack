/**
 * Live-check apply / listings links before posting.
 * Rejects HTTP dead links (404/410) and pages whose body says the job is closed
 * even when the server still returns 200.
 *
 * Careers listing boards often rate-limit or bot-wall scrapers (403/429);
 * use checkListingsUrl for those so a board wall does not block a good JD.
 */

const CLOSED_JOB_RE =
  /no longer available|job not found|this job is closed|position has been filled|no longer accepting|opening is closed|job has expired|this posting has expired|requisition.{0,40}(closed|cancelled|canceled)|we are no longer accepting|page you requested.{0,40}(not found|doesn.?t exist|does not exist)|job unavailable|this position is no longer|opportunity has been filled|sorry.? this job|posted job is not available|job posting has been removed|this job is no longer posted|role is no longer open|vacancy has been filled|position is closed|job you are trying to view is not available|couldn.?t find that job|we can.?t find this job|this job posting is no longer|currently unavailable|no longer active/i;

async function probeUrl(href, { timeoutMs = 18000, readBody = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(href, {
      method: readBody ? "GET" : "HEAD",
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
      !readBody &&
      (res.status === 405 ||
        res.status === 501 ||
        res.status === 403 ||
        res.status === 404 ||
        res.status === 429)
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
      readBody = true;
    }

    let body = "";
    if (readBody) {
      body = await res.text();
    } else if (res.status >= 200 && res.status < 400) {
      // Always inspect apply-page bodies when status looks fine — many ATS
      // hosts keep returning 200 for closed requisitions.
      const getRes = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
      });
      res = getRes;
      body = await getRes.text();
    }

    const closedInBody = body ? CLOSED_JOB_RE.test(body.slice(0, 120000)) : false;
    return {
      status: res.status,
      error: null,
      closedInBody,
      finalUrl: res.url,
    };
  } catch (error) {
    return {
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      closedInBody: false,
      finalUrl: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkApplyUrl(href, { timeoutMs = 18000 } = {}) {
  const { status, error, closedInBody } = await probeUrl(href, {
    timeoutMs,
    readBody: true,
  });
  if (error) {
    return { ok: false, status: 0, reason: error };
  }
  if (status === 404 || status === 410 || status === 451) {
    return { ok: false, status, reason: "dead_link" };
  }
  if (closedInBody) {
    return { ok: false, status, reason: "closed_job_page" };
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
  const { status, error } = await probeUrl(href, {
    timeoutMs,
    readBody: false,
  });
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
