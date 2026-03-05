import fs from "node:fs/promises";
import path from "node:path";

const REPORT_DIR = path.resolve(process.cwd(), "blog/reports");
const OUT_DIR = path.resolve(process.cwd(), "advisor");
const OUT_REPORT_DIR = path.join(OUT_DIR, "reports");
const OUT_PROMPTS_DIR = path.join(OUT_DIR, "prompts");
const WINDOW_DAYS = Math.max(1, Number(process.env.ADVISOR_WINDOW_DAYS || 3));

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateFromFilename(file) {
  const m = String(file).match(/^(\d{4}-\d{2}-\d{2})-/);
  if (!m) return null;
  const dt = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function withinWindow(dt, days) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return dt >= cutoff;
}

function contains(haystack, re) {
  return re.test(String(haystack || ""));
}

async function loadRecentReports() {
  let names = [];
  try {
    names = await fs.readdir(REPORT_DIR);
  } catch {
    return [];
  }

  const files = names.filter((n) => n.endsWith('.json'));
  const out = [];

  for (const file of files) {
    const dt = parseDateFromFilename(file);
    if (!dt || !withinWindow(dt, WINDOW_DAYS)) continue;
    const full = path.join(REPORT_DIR, file);
    try {
      const raw = await fs.readFile(full, 'utf8');
      const report = JSON.parse(raw);
      out.push({ file, date: dt.toISOString().slice(0, 10), report });
    } catch {}
  }

  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function buildRecommendations(recent) {
  const recs = [];
  const total = recent.length;
  if (!total) return recs;

  const errors = recent.filter((r) => r.report?.status === 'error');
  const ctaTimeouts = recent.filter((r) => {
    const text = `${r.report?.error || ''}\n${(r.report?.notes || []).join('\n')}`;
    return contains(text, /take on the challenge|dashboard did not become ready|timeout/i);
  });

  const lowCompletion = recent.filter((r) => Number(r.report?.lessonsCompleted || 0) <= 1);
  const lowScore = recent.filter((r) => Number(r.report?.score || 0) < 40);

  if (ctaTimeouts.length >= 1) {
    recs.push({
      id: `adv-${todayStamp()}-01`,
      priority: ctaTimeouts.length >= 2 ? 'P0' : 'P1',
      title: 'Harden dashboard CTA + readiness fallbacks',
      problem_evidence: [
        `${ctaTimeouts.length}/${total} recent runs mention CTA/readiness timeout`,
        ...ctaTimeouts.slice(0, 2).map((x) => `${x.file}: ${x.report?.error || (x.report?.notes || []).find((n) => /timeout|challenge|ready/i.test(n)) || 'timeout signal'}`),
      ],
      proposed_change: 'Add fallback selectors and state probes for Story Mode entry; if unavailable, surface alternate next action without run failure.',
      implementation_prompt: 'Update synthetic runner + dashboard UI to use resilient CTA matching, retry with progressive waits, and non-fatal fallback when Story Mode is temporarily unavailable.',
      expected_impact: 'Reduce automation failures and improve consistency of generated student posts.',
      confidence: Math.min(0.95, 0.55 + ctaTimeouts.length / Math.max(1, total)),
      estimated_effort: 'S',
    });
  }

  if (errors.length >= 1) {
    recs.push({
      id: `adv-${todayStamp()}-02`,
      priority: errors.length >= 2 ? 'P0' : 'P1',
      title: 'Add structured failure telemetry for synthetic runs',
      problem_evidence: [
        `${errors.length}/${total} runs ended in error status`,
        ...errors.slice(0, 2).map((x) => `${x.file}: ${x.report?.error || 'Unknown error'}`),
      ],
      proposed_change: 'Capture failure class, failed step, selector/url, and screenshot path in report JSON.',
      implementation_prompt: 'Extend report schema with telemetry fields (failureClass, failedStep, selector, screenshotPath, attemptCount) and persist screenshot on failure for rapid diagnosis.',
      expected_impact: 'Faster root-cause detection and fewer repeated regressions.',
      confidence: Math.min(0.95, 0.5 + errors.length / Math.max(1, total)),
      estimated_effort: 'S',
    });
  }

  if (lowCompletion.length >= 2 || lowScore.length >= 2) {
    recs.push({
      id: `adv-${todayStamp()}-03`,
      priority: 'P1',
      title: 'Improve low-performance recovery path in dashboard',
      problem_evidence: [
        `${lowCompletion.length}/${total} runs completed <=1 lesson`,
        `${lowScore.length}/${total} runs scored <40 points`,
      ],
      proposed_change: 'When learner momentum is low, bias Self Study picks toward short-win modules and show one-click recovery mission.',
      implementation_prompt: 'Add a momentum-aware branch in Dashboard next actions and Self Study ranking that prioritizes easier high-success modules after low-score sessions.',
      expected_impact: 'Higher completion rates and better synthetic/user sentiment.',
      confidence: 0.62,
      estimated_effort: 'M',
    });
  }

  if (!recs.length) {
    recs.push({
      id: `adv-${todayStamp()}-00`,
      priority: 'P2',
      title: 'No major regressions detected; continue incremental UX tuning',
      problem_evidence: [`${total} recent runs analyzed with no strong recurring failures.`],
      proposed_change: 'Maintain current trajectory and refine instructional cues.',
      implementation_prompt: 'Review module entry microcopy and improve “what to do next” hints in dashboard cards.',
      expected_impact: 'Steady UX polish without risky changes.',
      confidence: 0.58,
      estimated_effort: 'S',
    });
  }

  return recs.slice(0, 5);
}

function toMarkdown({ date, windowDays, totalReports, recs }) {
  const lines = [];
  lines.push(`# Synthetic Advisor Report — ${date}`);
  lines.push('');
  lines.push(`- Window: last **${windowDays} day(s)**`);
  lines.push(`- Reports analyzed: **${totalReports}**`);
  lines.push(`- Recommendations: **${recs.length}**`);
  lines.push('');

  recs.forEach((r, idx) => {
    lines.push(`## ${idx + 1}. [${r.priority}] ${r.title}`);
    lines.push('');
    lines.push('**Evidence**');
    for (const e of r.problem_evidence || []) lines.push(`- ${e}`);
    lines.push('');
    lines.push(`**Proposed change**: ${r.proposed_change}`);
    lines.push('');
    lines.push(`**Implementation prompt**: ${r.implementation_prompt}`);
    lines.push('');
    lines.push(`**Expected impact**: ${r.expected_impact}`);
    lines.push('');
    lines.push(`**Confidence**: ${Math.round(Number(r.confidence || 0) * 100)}% · **Effort**: ${r.estimated_effort}`);
    lines.push('');
  });

  return lines.join('\n');
}

async function main() {
  const date = todayStamp();
  await fs.mkdir(OUT_REPORT_DIR, { recursive: true });
  await fs.mkdir(OUT_PROMPTS_DIR, { recursive: true });

  const recent = await loadRecentReports();
  const recommendations = buildRecommendations(recent);

  const payload = {
    date,
    window_days: WINDOW_DAYS,
    total_reports: recent.length,
    recommendations,
  };

  const md = toMarkdown({
    date,
    windowDays: WINDOW_DAYS,
    totalReports: recent.length,
    recs: recommendations,
  });

  const reportPath = path.join(OUT_REPORT_DIR, `${date}.md`);
  const promptsPath = path.join(OUT_PROMPTS_DIR, `${date}.json`);

  await fs.writeFile(reportPath, md, 'utf8');
  await fs.writeFile(promptsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Synthetic advisor complete.`);
  console.log(`Report: ${reportPath}`);
  console.log(`Prompts: ${promptsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
