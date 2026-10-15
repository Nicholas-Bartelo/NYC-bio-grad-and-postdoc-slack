import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "post-now",
      description: "On-demand request posts a biology topic via the tool.",
      async test(t) {
        await t.send(
          "Post today's biology Topic of the Day to the channel now.",
        );
        t.succeeded();
        t.calledTool("list_recent_topics");
        t.calledTool("post_topic_of_day");
        t.check(t.reply, includes(/post|topic|biology|channel/i));
      },
    },
  ],
});
