import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPO = process.env.BLOG_REPO || "ceazon/spanish-app";
const ADVISOR_PROMPTS_PATH = process.env.ADVISOR_PROMPTS_PATH || "advisor/prompts";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "chadlingo-admin" } });
  if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);
  return res.json();
}

async function fetchGithubText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "chadlingo-admin" } });
  if (!res.ok) throw new Error(`GitHub text fetch failed (${res.status})`);
  return res.text();
}

function normalizeLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || 5, 20));
}

async function listAdvisorFromGithub(limit = 5) {
  const apiUrl = `https://api.github.com/repos/${DEFAULT_REPO}/contents/${ADVISOR_PROMPTS_PATH}`;
  const items = await fetchJson(apiUrl);
  const jsonFiles = (Array.isArray(items) ? items : [])
    .filter((it) => it?.type === "file" && String(it.name || "").endsWith(".json"))
    .sort((a, b) => String(b.name).localeCompare(String(a.name)))
    .slice(0, normalizeLimit(limit));

  const reports = [];
  for (const item of jsonFiles) {
    try {
      const raw = await fetchGithubText(item.download_url);
      const parsed = JSON.parse(raw);
      reports.push({
        file: item.name,
        date: parsed?.date || String(item.name).replace(/\.json$/i, ""),
        window_days: Number(parsed?.window_days || 0),
        total_reports: Number(parsed?.total_reports || 0),
        recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : [],
      });
    } catch {}
  }

  return { source: "github", reports };
}

async function listAdvisorFromLocal(limit = 5) {
  const dir = path.resolve(process.cwd(), ADVISOR_PROMPTS_PATH);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name)
    .sort((a, b) => String(b).localeCompare(String(a)))
    .slice(0, normalizeLimit(limit));

  const reports = [];
  for (const name of files) {
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      const parsed = JSON.parse(raw);
      reports.push({
        file: name,
        date: parsed?.date || String(name).replace(/\.json$/i, ""),
        window_days: Number(parsed?.window_days || 0),
        total_reports: Number(parsed?.total_reports || 0),
        recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : [],
      });
    } catch {}
  }

  return { source: "local", reports };
}

export async function listAdvisorReports(limit = 5) {
  try {
    return await listAdvisorFromGithub(limit);
  } catch (githubError) {
    const local = await listAdvisorFromLocal(limit);
    return {
      ...local,
      warning: `GitHub advisor prompts unavailable (${githubError?.message || "unknown error"}). Showing local advisor prompts instead.`,
    };
  }
}
