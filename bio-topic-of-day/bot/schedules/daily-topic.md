---
cron: "0 12 * * *"
---

It is the daily 8:00 AM Eastern Topic of the Day fire.

Post one biology discussion topic to the Topic of the Day Slack channel.

1. Call `list_recent_topics` and avoid repeating those titles or near-duplicates.
2. Pick a topic from **any** field of biology (molecular, cellular, organismal, ecological, evolutionary, medical, microbiology, neuroscience, genetics, plant biology, etc.). Rotate fields across days.
3. Call `post_topic_of_day` exactly once with:
   - a crisp title
   - the biology field label
   - a short accessible blurb (2–4 sentences)
   - one open discussion prompt
4. Reply with a one-line confirmation (posted / already posted / error). Do not invent a Slack post in the reply — the tool does the posting.
