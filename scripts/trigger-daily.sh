#!/usr/bin/env bash
# Fire the Daily Slack posts workflow via repository_dispatch.
# Usage: GH_TOKEN=ghp_... ./scripts/trigger-daily.sh
set -euo pipefail

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "Set GH_TOKEN (fine-grained PAT with Actions: write on this repo)." >&2
  exit 1
fi

REPO="${GITHUB_REPOSITORY:-Nicholas-Bartelo/NYC-bio-grad-and-postdoc-slack}"
URL="https://api.github.com/repos/${REPO}/dispatches"

HTTP=$(curl -sS -o /tmp/dispatch_body.txt -w "%{http_code}" -X POST "$URL" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"daily-slack-posts"}')

echo "HTTP $HTTP"
if [[ "$HTTP" != "204" ]]; then
  cat /tmp/dispatch_body.txt >&2
  echo >&2
  exit 1
fi
echo "Dispatched daily-slack-posts. Check Actions in ~10s."
