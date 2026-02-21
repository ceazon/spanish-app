import { assertAdminPassword, parseJsonBody } from "../_lib/admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req);
  if (!body) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const check = assertAdminPassword(body?.password || "");
  if (!check.ok) {
    res.status(check.code).json({ error: check.error });
    return;
  }

  res.status(200).json({ ok: true });
}
