import { probeProviders } from "../_lib/ai.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const status = await probeProviders();
  res.status(200).json(status);
}
