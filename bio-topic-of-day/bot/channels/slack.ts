import { slackChannel } from "@cursor/bdk/channels/slack";

export default slackChannel({
  envPrefix: "BIO_TOPIC_OF_DAY",
  suggestedPrompts: [
    {
      title: "Post today's topic",
      message: "Post today's biology Topic of the Day to the channel now.",
    },
    {
      title: "Suggest a topic",
      message:
        "Suggest a biology discussion topic without posting it yet.",
    },
    {
      title: "Recent topics",
      message: "What biology topics have been posted recently?",
    },
  ],
  suggestedPromptsTitle: "Biology topics",
});
