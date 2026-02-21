import { assertAdminPassword, getAdminPasswordFromRequest, parseJsonBody } from "../../_lib/admin.js";
import { approveDraft } from "../../_lib/blog.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = assertAdminPassword(getAdminPasswordFromRequest(req));
  if (!auth.ok) {
    res.status(auth.code).json({ error: auth.error });
    return;
  }

  const body = parseJsonBody(req);
  const slug = String(body?.slug || "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  try {
    const approved = await approveDraft(slug);
    res.status(200).json({ ok: true, approved });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to approve draft" });
  }
}
