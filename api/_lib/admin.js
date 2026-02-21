export function parseJsonBody(req) {
  try {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    return null;
  }
}

export function assertAdminPassword(inputPassword) {
  const expected = (process.env.ADMIN_PASSWORD || "").trim();
  if (!expected) return { ok: false, code: 500, error: "ADMIN_PASSWORD is not configured" };
  if (!inputPassword || inputPassword !== expected) return { ok: false, code: 401, error: "Unauthorized" };
  return { ok: true };
}

export function getAdminPasswordFromRequest(req) {
  const header = req.headers?.["x-admin-password"] || req.headers?.["X-Admin-Password"];
  return typeof header === "string" ? header : "";
}
