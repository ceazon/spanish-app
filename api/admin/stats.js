import { assertAdminPassword, getAdminPasswordFromRequest } from "../_lib/admin.js";
import { getStats } from "../_lib/analytics.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = assertAdminPassword(getAdminPasswordFromRequest(req));
  if (!auth.ok) {
    res.status(auth.code).json({ error: auth.error });
    return;
  }

  try {
    const stats = await getStats();
    res.status(200).json({ ok: true, stats });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to load stats" });
  }
}
