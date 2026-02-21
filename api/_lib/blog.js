import { Redis } from "@upstash/redis";

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : null;

const DEFAULT_REPO = process.env.BLOG_REPO || "ceazon/spanish-app";
const DEFAULT_PATH = process.env.BLOG_DRAFTS_PATH || "blog/drafts";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "chadlingo-admin" } });
  if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);
  return res.json();
}

export async function listDraftPosts(limit = 20) {
  const apiUrl = `https://api.github.com/repos/${DEFAULT_REPO}/contents/${DEFAULT_PATH}`;
  const items = await fetchJson(apiUrl);
  const mdFiles = (Array.isArray(items) ? items : [])
    .filter((it) => it?.type === "file" && String(it.name || "").endsWith(".md"))
    .sort((a, b) => String(b.name).localeCompare(String(a.name)))
    .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));

  const posts = await Promise.all(
    mdFiles.map(async (f) => {
      let excerpt = "";
      try {
        const txtRes = await fetch(f.download_url, { headers: { "User-Agent": "chadlingo-admin" } });
        const txt = txtRes.ok ? await txtRes.text() : "";
        excerpt = txt.split("\n").slice(0, 6).join("\n").slice(0, 360);
      } catch {}

      return {
        slug: String(f.name).replace(/\.md$/i, ""),
        name: f.name,
        path: f.path,
        htmlUrl: f.html_url,
        downloadUrl: f.download_url,
        excerpt,
      };
    }),
  );

  return posts;
}

export async function approveDraft(slug) {
  if (!redis) throw new Error("Redis/KV not configured");
  const now = new Date().toISOString();
  const key = `blog:approved:${slug}`;
  await redis.hset(key, { slug, approvedAt: now });
  await redis.sadd("blog:approved", slug);
  return { slug, approvedAt: now };
}

export async function getApprovedSet() {
  if (!redis) return [];
  const out = await redis.smembers("blog:approved");
  return Array.isArray(out) ? out.map(String) : [];
}
