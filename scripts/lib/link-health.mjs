/**
 * Live-check apply / listings links before posting.
 *
 * Detects:
 * - HTTP 404/410/451
 * - Greenhouse redirects to ?error=true / board homepage (expired JD)
 * - Workday: job missing from CXS search by requisition id (SPA HTML is unreliable)
 * - Body copy that says the job is closed
 *
 * Careers listing boards often rate-limit scrapers (403/429);
 * use checkListingsUrl for those so a board wall does not block a good JD.
 */

const CLOSED_JOB_RE =
  /no longer available|job not found|this job is closed|position has been filled|no longer accepting|opening is closed|job has expired|this posting has expired|requisition.{0,40}(closed|cancelled|canceled)|we are no longer accepting|page you requested.{0,40}(not found|doesn.?t exist|does not exist)|job unavailable|this position is no longer|opportunity has been filled|sorry.? this job|posted job is not available|job posting has been removed|this job is no longer posted|role is no longer open|vacancy has been filled|position is closed|job you are trying to view is not available|couldn.?t find that job|we can.?t find this job|this job posting is no longer|currently unavailable|no longer active|this job is no longer accepting applications/i;

function isGreenhouseHost(hostname) {
  return (
    hostname === "boards.greenhouse.io" ||
    hostname === "job-boards.greenhouse.io"
  );
}

function isWorkdayHost(hostname) {
  return hostname.endsWith("myworkdayjobs.com");
}

function greenhouseLostJob(originalUrl, finalUrl) {
  try {
    const a = new URL(originalUrl);
    const b = new URL(finalUrl);
    if (!isGreenhouseHost(a.hostname)) return false;
    if (/[?&]error=true\b/i.test(b.search)) return true;
    const hadId = /\/jobs\/\d+/.test(a.pathname);
    const stillHasId = /\/jobs\/\d+/.test(b.pathname);
    return hadId && !stillHasId;
  } catch {
    return false;
  }
}

/** Parse Workday external career URL → tenant/site/slug/req id. */
export function parseWorkdayJobUrl(href) {
  try {
    const u = new URL(href);
    if (!isWorkdayHost(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const jobIdx = parts.findIndex((p) => p.toLowerCase() === "job");
    if (jobIdx < 1 || !parts[jobIdx + 1]) return null;
    const site = parts[jobIdx - 1];
    // Paths are either /job/SLUG or /job/Location/SLUG
    let slug = parts[jobIdx + 1];
    if (parts[jobIdx + 2] && !parts[jobIdx + 1].includes("_") && parts[jobIdx + 2].includes("_")) {
      slug = parts[jobIdx + 2];
    }
    const idMatch = slug.match(/_((?:JR|R-?)?[A-Z]?\d[\w-]*)$/i);
    return {
      host: u.hostname,
      tenant: u.hostname.split(".")[0],
      site,
      slug,
      reqId: idMatch ? idMatch[1] : null,
      origin: u.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Workday SPA shells often return HTTP 200 for closed jobs.
 * Confirm the requisition still appears in the public CXS jobs search.
 */
export async function checkWorkdayJobLive(href) {
  const parsed = parseWorkdayJobUrl(href);
  if (!parsed) return null;

  const tryIds = [];
  if (parsed.reqId) {
    tryIds.push(parsed.reqId);
    if (/-1$/i.test(parsed.reqId)) tryIds.push(parsed.reqId.replace(/-1$/i, ""));
  }
  // Fallback: last numeric chunk in slug
  const num = parsed.slug.match(/(\d{5,})/);
  if (num && !tryIds.includes(num[1])) tryIds.push(num[1]);

  if (!tryIds.length) {
    return { ok: null, status: 0, reason: "workday_no_req_id" };
  }

  const api = `https://${parsed.host}/wday/cxs/${parsed.tenant}/${parsed.site}/jobs`;
  for (const id of tryIds) {
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 20,
          offset: 0,
          searchText: id,
        }),
      });
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        return { ok: null, status: res.status, reason: "workday_search_blocked" };
      }
      if (res.status === 404 || res.status === 410) {
        return { ok: false, status: res.status, reason: "workday_search_dead" };
      }
      if (res.status < 200 || res.status >= 400) {
        return { ok: null, status: res.status, reason: `workday_search_http_${res.status}` };
      }
      const json = await res.json();
      const hit = (json.jobPostings || []).find((j) =>
        String(j.externalPath || "").includes(id)
      );
      if (hit) {
        const path = hit.externalPath.startsWith("/")
          ? hit.externalPath
          : `/${hit.externalPath}`;
        const canonical = `${parsed.origin}/en-US/${parsed.site}${path}`;
        return {
          ok: true,
          status: res.status,
          reason: null,
          title: hit.title || null,
          canonicalUrl: canonical,
        };
      }
    } catch (error) {
      return {
        ok: null,
        status: 0,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { ok: false, status: 200, reason: "workday_req_not_listed" };
}

async function probeHtml(href, { timeoutMs = 18000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const body = await res.text();
    return {
      status: res.status,
      error: null,
      body,
      finalUrl: res.url,
    };
  } catch (error) {
    return {
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      body: "",
      finalUrl: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkApplyUrl(href, { timeoutMs = 18000 } = {}) {
  // Workday: CXS search is authoritative (HTML is often an empty SPA shell).
  if (href && isWorkdayHost(new URL(href).hostname)) {
    const wd = await checkWorkdayJobLive(href);
    if (wd && wd.ok === true) {
      return { ok: true, status: wd.status, canonicalUrl: wd.canonicalUrl || null };
    }
    if (wd && wd.ok === false) {
      return { ok: false, status: wd.status, reason: wd.reason };
    }
    // Inconclusive (blocked) — fall through to HTML heuristics.
  }

  const { status, error, body, finalUrl } = await probeHtml(href, { timeoutMs });
  if (error) {
    return { ok: false, status: 0, reason: error };
  }
  if (status === 404 || status === 410 || status === 451) {
    return { ok: false, status, reason: "dead_link" };
  }
  if (finalUrl && greenhouseLostJob(href, finalUrl)) {
    return { ok: false, status, reason: "greenhouse_expired_redirect" };
  }
  if (body && CLOSED_JOB_RE.test(body.slice(0, 150000))) {
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
  const { status, error } = await probeHtml(href, { timeoutMs });
  if (error) {
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
