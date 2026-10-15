/** Shared helpers for daily biology topic posting. */

export const RECENT_TOPICS_KEY = "bio-topic:recent";
export const RECENT_LIMIT = 30;
export const DEFAULT_CHANNEL_NAME = "topic-of-day";
export const CHANNEL_ID_ENV = "BIO_TOPIC_OF_DAY_CHANNEL_ID";
export const CHANNEL_NAME_ENV = "BIO_TOPIC_OF_DAY_CHANNEL_NAME";

const CHANNEL_ID_RE = /^[CG][A-Z0-9]+$/i;

export type TopicRecord = {
  date: string;
  title: string;
  field: string;
  postedAt: string;
  messageTs?: string;
  channelId?: string;
};

export type RecentTopicsStore = {
  topics: TopicRecord[];
};

export function easternDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function postedKeyForDate(date: string): string {
  return `bio-topic:posted:${date}`;
}

export function resolveConfiguredChannel(): { channelId?: string; channelName: string } {
  const channelId = process.env[CHANNEL_ID_ENV]?.trim();
  const channelName = (
    process.env[CHANNEL_NAME_ENV]?.trim() ||
    DEFAULT_CHANNEL_NAME
  ).replace(/^#/, "");
  if (channelId && CHANNEL_ID_RE.test(channelId)) {
    return { channelId, channelName };
  }
  return { channelName };
}

export function normalizeRecent(raw: unknown): TopicRecord[] {
  if (raw === null || typeof raw !== "object") {
    return [];
  }
  const topics = (raw as RecentTopicsStore).topics;
  if (!Array.isArray(topics)) {
    return [];
  }
  return topics.filter(
    (t): t is TopicRecord =>
      t !== null &&
      typeof t === "object" &&
      typeof t.date === "string" &&
      typeof t.title === "string" &&
      typeof t.field === "string" &&
      typeof t.postedAt === "string",
  );
}

type SlackClient = {
  users: {
    conversations: (args: {
      types: string;
      exclude_archived: boolean;
      limit: number;
      cursor?: string;
    }) => Promise<{
      channels?: Array<{ id?: string; name?: string }>;
      response_metadata?: { next_cursor?: string };
    }>;
  };
};

export async function resolveChannelId(
  client: SlackClient,
  configured: { channelId?: string; channelName: string },
): Promise<string | undefined> {
  if (configured.channelId) {
    return configured.channelId;
  }
  const trimmed = configured.channelName.replace(/^#/, "");
  if (CHANNEL_ID_RE.test(trimmed)) {
    return trimmed;
  }
  let cursor: string | undefined;
  for (let page = 0; page < 8; page++) {
    const listed = await client.users.conversations({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    const match = listed.channels?.find((channel) => channel.name === trimmed);
    if (match?.id !== undefined) {
      return match.id;
    }
    cursor = listed.response_metadata?.next_cursor;
    if (cursor === undefined || cursor === "") {
      return undefined;
    }
  }
  return undefined;
}

export function formatTopicMessage(input: {
  title: string;
  field: string;
  blurb: string;
  prompt: string;
  date: string;
}): string {
  return [
    `*Topic of the Day — ${input.date}*`,
    "",
    `*${input.title}*`,
    `_${input.field}_`,
    "",
    input.blurb.trim(),
    "",
    `*Discussion prompt:* ${input.prompt.trim()}`,
  ].join("\n");
}
