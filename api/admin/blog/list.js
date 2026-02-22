import { assertAdminPassword, getAdminPasswordFromRequest } from "../../_lib/admin.js";
import { getApprovedSet, listDraftPosts } from "../../_lib/blog.js";

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
    const draftResult = await listDraftPosts(Number(req.query?.limit || 20));
    const drafts = Array.isArray(draftResult) ? draftResult : draftResult.posts;
    const approved = await getApprovedSet();
    const approvedSet = new Set(approved);
    const posts = drafts.map((d) => ({ ...d, approved: approvedSet.has(d.slug) }));
    res.status(200).json({
      ok: true,
      posts,
      source: Array.isArray(draftResult) ? "github" : draftResult?.source || "github",
      warning: Array.isArray(draftResult) ? undefined : draftResult?.warning,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to list blog drafts" });
  }
}
