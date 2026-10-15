export async function postViaWebhook(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text, mrkdwn: true }),
  });
  const body = await res.text();
  if (!res.ok || body !== "ok") {
    throw new Error(`Webhook post failed: ${res.status} ${body}`);
  }
}
