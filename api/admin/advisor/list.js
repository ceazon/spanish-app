import { assertAdminPassword, getAdminPasswordFromRequest } from "../../_lib/admin.js";
import { listAdvisorReports } from "../../_lib/advisor.js";

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
    const out = await listAdvisorReports(Number(req.query?.limit || 5));
    res.status(200).json({
      ok: true,
      reports: Array.isArray(out?.reports) ? out.reports : [],
      source: out?.source || "github",
      warning: out?.warning,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to list advisor reports" });
  }
}
