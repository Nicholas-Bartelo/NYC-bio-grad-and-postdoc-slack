export function assertWebhookUrl(webhookUrl) {
  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw new Error(
      "Invalid webhook secret: not a URL. It must look like https://hooks.slack.com/services/T…/B…/…",
    );
  }
  if (url.protocol !== "https:") {
    throw new Error("Invalid webhook secret: must start with https://");
  }
  if (url.hostname === "api.slack.com" || url.pathname.includes("app-settings")) {
    throw new Error(
      "Invalid webhook secret: this is a Slack app settings page URL, not an Incoming Webhook. In the Slack app go to Incoming Webhooks, copy the URL that starts with https://hooks.slack.com/services/…, and put that in the GitHub secret.",
    );
  }
  if (url.hostname !== "hooks.slack.com" || !url.pathname.startsWith("/services/")) {
    throw new Error(
      `Invalid webhook secret host/path (${url.hostname}${url.pathname}). Expected https://hooks.slack.com/services/T…/B…/…`,
    );
  }
}

export async function postViaWebhook(webhookUrl, text) {
  assertWebhookUrl(webhookUrl);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text, mrkdwn: true }),
  });
  const body = await res.text();
  if (!res.ok || body !== "ok") {
    const snippet = body.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`Webhook post failed: ${res.status} ${snippet}`);
  }
}
