import { parseJsonBody } from "../_lib/admin.js";
import { trackEvent } from "../_lib/analytics.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const payload = parseJsonBody(req);
  if (!payload) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  try {
    const result = await trackEvent(payload);
    res.status(200).json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to track event" });
  }
}
