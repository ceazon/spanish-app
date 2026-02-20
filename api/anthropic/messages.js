import { generateWithFallback } from "../_lib/ai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let payload = {};
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const result = await generateWithFallback(payload);
  res.status(result.status).setHeader("Content-Type", result.contentType).send(result.body);
}
