# Post as you (editable Slack messages)

Incoming Webhooks post as the **app**, so you cannot Edit those messages.
To post **as your Slack user** (and edit in the UI), use a User OAuth Token.

## One-time Slack setup

1. Open https://api.slack.com/apps → select the app you already use for this workspace (or **Create New App** → From scratch).
2. **OAuth & Permissions** → **User Token Scopes** → add:
   - `chat:write` — post messages as you  
   - `channels:read` — find public channels by name  
   - `groups:read` — find private channels by name (needed for `#opportunities-spatial`)
3. Click **Install to Workspace** (or **Reinstall** if you added scopes).
4. Approve as **yourself** (the account that should own the posts).
5. Copy the **User OAuth Token** — it starts with `xoxp-`.

You must be a **member** of every target channel (including private `#opportunities-spatial`).

## GitHub secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Required | Purpose |
| --- | --- | --- |
| `SLACK_USER_TOKEN` | **Yes** | Your `xoxp-…` token |
| `SLACK_CHANNEL_ID_TOPIC_OF_DAY` | Optional | Channel ID for `#topic-of-day` |
| `SLACK_CHANNEL_ID_OPPORTUNITIES_BIOTECH` | Optional | `#opportunities-biotech` |
| `SLACK_CHANNEL_ID_OPPORTUNITIES_VC` | Optional | `#opportunities-vc` |
| `SLACK_CHANNEL_ID_OPPORTUNITIES_PHARMA` | Optional | `#opportunities-pharma` |
| `SLACK_CHANNEL_ID_OPPORTUNITIES_ENTREPRENEURSHIP` | Optional | `#opportunities-entrepreneurship` |
| `SLACK_CHANNEL_ID_OPPORTUNITIES_SPATIAL` | Optional | `#opportunities-spatial` |

### How to copy a channel ID

In Slack: open the channel → click the channel name → scroll to the bottom of **About** → **Channel ID** → Copy.

IDs look like `C0123ABCD` (public) or `G0123ABCD` / `C…` (private).  
If you skip IDs, the scripts resolve channels by name (you must be a member).

## Behavior

- If `SLACK_USER_TOKEN` is set, daily posts try `chat.postMessage` **as you** first.
- If that fails (not in the channel, missing scopes, bad token), the workflow **falls back to the Incoming Webhook** so posts still go out.
- Webhook fallback messages are **not editable**. Editable posts require: join every target channel + valid `xoxp-` scopes (`chat:write`, `channels:read`, `groups:read`).
- After user-token posting works, new posts show your name and have **Edit** in Slack.

## Test

1. Add `SLACK_USER_TOKEN` (and optional channel IDs).
2. GitHub → **Actions → Daily Slack posts → Run workflow** (check **force_repost** if you already posted today).
3. Confirm the new message is from **you** and that **Edit** works.

## Security

- Treat `xoxp-` like a password. Only store it in GitHub Actions secrets.
- If the token leaks, revoke it: Slack app → **OAuth & Permissions** → revoke/reinstall, then update the secret.
