import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod/v3";
import {
  RECENT_LIMIT,
  RECENT_TOPICS_KEY,
  easternDateKey,
  formatTopicMessage,
  normalizeRecent,
  postedKeyForDate,
  resolveChannelId,
  resolveConfiguredChannel,
  type TopicRecord,
} from "../lib/topics.js";

export default defineTool({
  description:
    "Post today's biology Topic of the Day to the configured Slack channel. Call once per day after composing the topic.",
  effect: "write",
  inputSchema: z.object({
    title: z.string().min(3).max(120).describe("Short topic title."),
    field: z
      .string()
      .min(2)
      .max(80)
      .describe(
        "Biology subfield, e.g. immunology, ecology, developmental biology.",
      ),
    blurb: z
      .string()
      .min(40)
      .max(800)
      .describe("2–4 sentences of accessible context for discussion."),
    prompt: z
      .string()
      .min(20)
      .max(300)
      .describe("One open discussion question for the channel."),
  }),
  async execute({ title, field, blurb, prompt }, ctx) {
    const date = easternDateKey();
    const text = formatTopicMessage({ title, field, blurb, prompt, date });

    if (ctx.session.purpose === "eval") {
      return {
        posted: false,
        reason: "eval",
        date,
        title,
        field,
        preview: text,
      };
    }

    const dayKey = postedKeyForDate(date);
    const already = await ctx.host.kv.get(dayKey);
    if (
      already !== null &&
      typeof already === "object" &&
      (already as { posted?: boolean }).posted === true
    ) {
      return {
        posted: false,
        reason: "already_posted_today",
        date,
        existing: already,
      };
    }

    let client;
    try {
      client = await ctx.host.slack.getClient();
    } catch (error) {
      return {
        posted: false,
        error: "slack_unavailable",
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    const configured = resolveConfiguredChannel();
    const channelId = await resolveChannelId(client, configured);
    if (channelId === undefined) {
      return {
        posted: false,
        error: "channel_not_found",
        channelName: configured.channelName,
        hint: `Invite the bot to #${configured.channelName}, or set ${"BIO_TOPIC_OF_DAY_CHANNEL_ID"} to the channel id.`,
      };
    }

    const result = await client.chat.postMessage({
      channel: channelId,
      text,
      mrkdwn: true,
      unfurl_links: false,
      unfurl_media: false,
    });

    if (!result.ok || typeof result.ts !== "string") {
      return {
        posted: false,
        error: "slack_post_failed",
        detail: result.error ?? "unknown",
        channelId,
      };
    }

    const record: TopicRecord = {
      date,
      title,
      field,
      postedAt: new Date().toISOString(),
      messageTs: result.ts,
      channelId,
    };

    const recent = normalizeRecent(await ctx.host.kv.get(RECENT_TOPICS_KEY));
    const next = [record, ...recent.filter((t) => t.date !== date)].slice(
      0,
      RECENT_LIMIT,
    );
    await ctx.host.kv.put(RECENT_TOPICS_KEY, { topics: next });
    await ctx.host.kv.put(dayKey, {
      posted: true,
      ...record,
    });

    return {
      posted: true,
      date,
      title,
      field,
      channelId,
      messageTs: result.ts,
    };
  },
});
