export async function sendMail(type, payload) {
  const base = process.env.MAIL_WORKER_URL;
  const secret = process.env.MAIL_SHARED_SECRET;
  if (!base || !secret) return { ok: false, error: "mail-not-configured" };
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/mail/send`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ type, ...payload }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, error: data.error || null };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}
