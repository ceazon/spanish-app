import { listApprovedPosts } from "../_lib/blog.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const posts = await listApprovedPosts(Number(req.query?.limit || 20));
    res.status(200).json({ ok: true, posts });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to load approved posts" });
  }
}
