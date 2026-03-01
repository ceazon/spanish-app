import fs from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : null;

const DEFAULT_REPO = process.env.BLOG_REPO || "ceazon/spanish-app";
const DEFAULT_PATH = process.env.BLOG_DRAFTS_PATH || "blog/drafts";
const REPORTS_PATH = String(DEFAULT_PATH || "blog/drafts").replace(/\/drafts$/i, "/reports");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "chadlingo-admin" } });
  if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);
  return res.json();
}

function normalizeLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || 20, 100));
}

function buildMeta(report) {
  if (!report || typeof report !== "object") return null;
  return {
    studentName: report.studentName || null,
    username: report.username || null,
    startedAt: report.startedAt || null,
    endedAt: report.endedAt || null,
    score: Number(report.score) || 0,
    lessonsCompleted: Number(report.lessonsCompleted) || 0,
    status: report.status || null,
  };
}

async function fetchGithubText(url) {
  const txtRes = await fetch(url, { headers: { "User-Agent": "chadlingo-admin" } });
  return txtRes.ok ? txtRes.text() : "";
}

async function fetchReportMetaFromGithub(slug) {
  try {
    const reportPath = `${REPORTS_PATH}/${slug}.json`;
    const metaUrl = `https://api.github.com/repos/${DEFAULT_REPO}/contents/${reportPath}`;
    const item = await fetchJson(metaUrl);
    if (!item?.download_url) return null;
    const txt = await fetchGithubText(item.download_url);
    return buildMeta(JSON.parse(txt));
  } catch {
    return null;
  }
}

async function fetchReportMetaFromLocal(slug) {
  try {
    const reportAbs = path.resolve(process.cwd(), REPORTS_PATH, `${slug}.json`);
    const txt = await fs.readFile(reportAbs, "utf8");
    return buildMeta(JSON.parse(txt));
  } catch {
    return null;
  }
}

async function listDraftPostsFromGithub(limit = 20) {
  const apiUrl = `https://api.github.com/repos/${DEFAULT_REPO}/contents/${DEFAULT_PATH}`;
  const items = await fetchJson(apiUrl);
  const mdFiles = (Array.isArray(items) ? items : [])
    .filter((it) => it?.type === "file" && String(it.name || "").endsWith(".md"))
    .sort((a, b) => String(b.name).localeCompare(String(a.name)))
    .slice(0, normalizeLimit(limit));

  const posts = await Promise.all(
    mdFiles.map(async (f) => {
      let excerpt = "";
      let content = "";
      try {
        const txt = await fetchGithubText(f.download_url);
        content = txt;
        excerpt = txt.split("\n").slice(0, 6).join("\n").slice(0, 360);
      } catch {}

      const slug = String(f.name).replace(/\.md$/i, "");
      const meta = await fetchReportMetaFromGithub(slug);

      return {
        slug,
        name: f.name,
        path: f.path,
        htmlUrl: f.html_url,
        downloadUrl: f.download_url,
        excerpt,
        content,
        meta,
      };
    }),
  );

  return { posts, source: "github" };
}

async function listDraftPostsFromLocal(limit = 20) {
  const draftsAbs = path.resolve(process.cwd(), DEFAULT_PATH);
  const dirEntries = await fs.readdir(draftsAbs, { withFileTypes: true });
  const mdFiles = dirEntries
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => d.name)
    .sort((a, b) => String(b).localeCompare(String(a)))
    .slice(0, normalizeLimit(limit));

  const posts = await Promise.all(
    mdFiles.map(async (name) => {
      const abs = path.join(draftsAbs, name);
      const txt = await fs.readFile(abs, "utf8").catch(() => "");
      const content = txt;
      const excerpt = txt.split("\n").slice(0, 6).join("\n").slice(0, 360);
      const relPath = `${DEFAULT_PATH}/${name}`;
      const slug = String(name).replace(/\.md$/i, "");
      const meta = await fetchReportMetaFromLocal(slug);
      return {
        slug,
        name,
        path: relPath,
        htmlUrl: null,
        downloadUrl: null,
        excerpt,
        content,
        meta,
      };
    }),
  );

  return { posts, source: "local" };
}

export async function listDraftPosts(limit = 20) {
  try {
    return await listDraftPostsFromGithub(limit);
  } catch (githubError) {
    try {
      const local = await listDraftPostsFromLocal(limit);
      return {
        ...local,
        warning: `GitHub drafts unavailable (${githubError?.message || "unknown error"}). Showing local drafts instead.`,
      };
    } catch {
      throw githubError;
    }
  }
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

function isLikelySyntheticDraft(draft = {}) {
  const content = String(draft?.content || draft?.excerpt || "").toLowerCase();
  const student = String(draft?.meta?.studentName || "").toLowerCase();
  const slug = String(draft?.slug || "").toLowerCase();

  const syntheticSignals = [
    "synthetic student diary",
    "studentbot_",
    "debug note",
    "environment:",
    "status: ok",
  ];

  if (student.startsWith("studentbot_")) return true;
  if (slug.includes("studentbot") || slug.includes("synthetic")) return true;
  return syntheticSignals.some((s) => content.includes(s));
}

export async function listApprovedPosts(limit = 20) {
  const draftResult = await listDraftPosts(limit);
  const drafts = Array.isArray(draftResult) ? draftResult : draftResult.posts;
  const approved = await getApprovedSet();
  const approvedSet = new Set(approved);

  return drafts
    .filter((d) => approvedSet.has(d.slug))
    .filter((d) => !isLikelySyntheticDraft(d))
    .sort((a, b) => String(b?.name || "").localeCompare(String(a?.name || "")));
}
