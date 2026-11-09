/**
 * Post to Slack. Prefer a user OAuth token (xoxp-…) so messages appear as
 * that person and can be edited in the Slack UI. Fall back to Incoming Webhooks.
 */
import { postViaWebhook } from "./slack-webhook.mjs";

const CHANNEL_ID_RE = /^[CG][A-Z0-9]+$/i;

export async function slackApi(token, method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`${method} failed: ${json.error ?? res.status}`);
  }
  return json;
}

export async function resolveChannelId(token, channelId, channelName) {
  if (channelId && CHANNEL_ID_RE.test(channelId)) {
    return channelId;
  }
  const name = (channelName || "").replace(/^#/, "").trim();
  if (!name) {
    throw new Error("Channel name or ID is required for user-token posting.");
  }
  if (CHANNEL_ID_RE.test(name)) {
    return name;
  }

  // Prefer channels the authorizing user is already in (includes private).
  let cursor;
  for (let page = 0; page < 20; page++) {
    const listed = await slackApi(token, "users.conversations", {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    const match = (listed.channels ?? []).find((c) => c.name === name);
    if (match?.id) {
      return match.id;
    }
    cursor = listed.response_metadata?.next_cursor;
    if (!cursor) {
      break;
    }
  }

  // Public-channel fallback via conversations.list (needs channels:read).
  cursor = undefined;
  for (let page = 0; page < 20; page++) {
    const listed = await slackApi(token, "conversations.list", {
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    const match = (listed.channels ?? []).find((c) => c.name === name);
    if (match?.id) {
      // Join so chat.postMessage succeeds for public channels.
      try {
        await slackApi(token, "conversations.join", { channel: match.id });
      } catch {
        // already_in_channel / missing_scope — still try posting with the id
      }
      return match.id;
    }
    cursor = listed.response_metadata?.next_cursor;
    if (!cursor) {
      break;
    }
  }

  const idHint = name.startsWith("opportunities-")
    ? `SLACK_CHANNEL_ID_${name.replace(/-/g, "_").toUpperCase()}`
    : "the matching SLACK_CHANNEL_ID_* secret";
  throw new Error(
    `Could not find #${name} in your conversations. Join the channel in Slack (required for private channels), ensure scopes chat:write + channels:read + groups:read, then retry — or set GitHub secret ${idHint}.`,
  );
}

export async function postViaUserToken(token, text, { channelId, channelName }) {
  if (!token.startsWith("xoxp-")) {
    throw new Error(
      "SLACK_USER_TOKEN must be a User OAuth Token starting with xoxp- (not a bot xoxb- token). Bot posts are not editable by you in Slack.",
    );
  }
  const id = await resolveChannelId(token, channelId, channelName);
  const result = await slackApi(token, "chat.postMessage", {
    channel: id,
    text,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
  });
  return { mode: "user_token", channelId: id, ts: result.ts };
}

function isRecoverableUserTokenError(err) {
  const msg = String(err?.message ?? err);
  return /Could not find #|not_in_channel|channel_not_found|missing_scope|invalid_auth|token_revoked|account_inactive|not_authed|users\.conversations failed|chat\.postMessage failed/i.test(
    msg,
  );
}

/**
 * Prefer user token (editable posts) → webhook → error.
 * If the user token cannot post (wrong scopes, not in channel, bad token),
 * fall back to the Incoming Webhook so daily automation keeps working.
 */
export async function postToSlack(text, {
  userToken,
  webhookUrl,
  channelId,
  channelName,
}) {
  const token = userToken?.trim();
  const webhook = webhookUrl?.trim();

  if (token) {
    try {
      return await postViaUserToken(token, text, { channelId, channelName });
    } catch (err) {
      if (!webhook || !isRecoverableUserTokenError(err)) {
        throw err;
      }
      console.warn(
        JSON.stringify({
          warning: "user_token_failed_falling_back_to_webhook",
          channel: channelName ?? channelId ?? null,
          reason: String(err?.message ?? err),
          note: "Webhook posts are not editable in Slack. Join the channel and fix SLACK_USER_TOKEN scopes for editable posts.",
        }),
      );
    }
  }

  if (webhook) {
    await postViaWebhook(webhook, text);
    return { mode: "webhook" };
  }

  throw new Error(
    "No Slack credentials. Set SLACK_USER_TOKEN (recommended, editable posts) or the channel webhook secret.",
  );
}
