import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod/v3";
import {
  RECENT_LIMIT,
  RECENT_TOPICS_KEY,
  normalizeRecent,
} from "../lib/topics.js";

export default defineTool({
  description:
    "List recently posted biology topics so today's pick does not repeat them.",
  effect: "read",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const topics = normalizeRecent(await ctx.host.kv.get(RECENT_TOPICS_KEY)).slice(
      0,
      RECENT_LIMIT,
    );
    return {
      count: topics.length,
      topics: topics.map((t) => ({
        date: t.date,
        title: t.title,
        field: t.field,
      })),
    };
  },
});
