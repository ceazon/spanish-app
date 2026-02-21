import { assertAdminPassword, getAdminPasswordFromRequest } from "../_lib/admin.js";
import { getUsers } from "../_lib/analytics.js";

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

  const limit = Number(req.query?.limit || 200);

  try {
    const users = await getUsers(limit);
    res.status(200).json({ ok: true, users });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to load users" });
  }
}
