# Reliable daily trigger (external cron)

GitHub’s built-in `schedule:` cron for this repo has been **hours late or skipped**.
Manual **Run workflow** always works. The reliable fix is a free external cron
service that pings GitHub every morning at **10:00 America/New_York**.

Your laptop does **not** need to be on.

## One-time setup (about 5 minutes)

### 1. Create a fine-grained GitHub PAT for the cron service only

1. Open https://github.com/settings/personal-access-tokens/new  
2. Name: `nyc-slack-daily-cron`  
3. Expiration: 90 days (or longer; rotate when it expires)  
4. Resource owner: your account  
5. Repository access: **Only select** `Nicholas-Bartelo/NYC-bio-grad-and-postdoc-slack`  
6. Permissions → Repository permissions — set only:
   - **Contents:** **Read and write**  
     (this is what `repository_dispatch` needs; you do **not** need an Actions permission)
   - **Metadata:** Read-only (usually added automatically)
7. Generate and **copy the token once**.  
   Store it only in cron-job.org (step 2). Do not commit it.

If you do not see **Contents → Read and write**, use a **classic** PAT instead:  
https://github.com/settings/tokens/new → enable **`repo`** → use that as the Bearer token.

### 2. Create the cron job at cron-job.org

1. Sign up / log in at https://cron-job.org (free).  
2. **Create cronjob** with:

| Field | Value |
| --- | --- |
| Title | NYC Slack daily posts |
| URL | `https://api.github.com/repos/Nicholas-Bartelo/NYC-bio-grad-and-postdoc-slack/dispatches` |
| Schedule | Every day at **10:00** |
| Timezone | **America/New_York** |
| Request method | **POST** |
| Enable | On |

3. **Request headers** (add each):

| Header | Value |
| --- | --- |
| `Accept` | `application/vnd.github+json` |
| `Authorization` | `Bearer PASTE_YOUR_PAT_HERE` |
| `Content-Type` | `application/json` |
| `X-GitHub-Api-Version` | `2022-11-28` |

4. **Request body**:

```json
{"event_type":"daily-slack-posts"}
```

5. Save. Use **“Run now”** once to verify (optional).  
   Then check GitHub → **Actions → Daily Slack posts** for a run with event `repository_dispatch`.

### 3. Expected result

- ~10:00 Eastern: cron-job.org POSTs to GitHub  
- GitHub Actions runs the workflow  
- Slack gets topic + opportunity posts  
- History files update so a late GitHub `schedule` backup that same day is a no-op  

## Why this works

| Trigger | Reliability on this repo |
| --- | --- |
| GitHub `schedule:` | Often delayed hours or skipped |
| Manual Run workflow | Works, but not automatic |
| **cron-job.org → `repository_dispatch`** | Fires on wall-clock time; laptop off |

## Rotate / revoke

- When the PAT expires, create a new one and update the Authorization header in cron-job.org.  
- Revoke old tokens at https://github.com/settings/tokens  
