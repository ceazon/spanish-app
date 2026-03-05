import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const EXPLICIT_BASE_URL = (process.env.STUDENT_BASE_URL || "").trim();
const PRIMARY_BASE_URL = EXPLICIT_BASE_URL || "https://chadlingo.com";
const BASE_URL_CANDIDATES = EXPLICIT_BASE_URL
  ? [PRIMARY_BASE_URL, process.env.STUDENT_BASE_URL_FALLBACK].filter(Boolean)
  : [
      PRIMARY_BASE_URL,
      process.env.STUDENT_BASE_URL_FALLBACK,
      "https://www.chadlingo.com",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
    ].filter(Boolean);

const STUDENT_PERSONAS = [
  {
    name: "Diego",
    handle: "diego",
    style: {
      titlePrefix: "I pushed through",
      intro: "I jumped in fast and went straight to practice mode.",
      story: (duration, lesson) => `I hit Story Mode for ${duration} and landed on ${lesson}.`,
      wordMatch: (category, mistakes, pts) => `I grinded ${category || "Word Match"}${mistakes ? `, made ${mistakes} mistakes,` : ""} and closed at ${pts} points.`,
      module: (name) => `After that I ran ${name} to keep momentum up.`,
      feltGood: ["The pace was great and I stayed in flow.", "Quick feedback made it easy to fix mistakes fast."],
      feltTricky: ["I still want clearer next-step prompts between modules."],
      goal: "Tomorrow I want to beat today’s score and tighten accuracy.",
      moodOk: "Competitive and focused",
      moodErr: "Frustrated but stubborn",
    },
  },
  {
    name: "María",
    handle: "maria",
    style: {
      titlePrefix: "I explored",
      intro: "I settled in and treated today like a mini language lab.",
      story: (duration, lesson) => `I opened with a ${duration} Story Mode run and got ${lesson}.`,
      wordMatch: (category, mistakes, pts) => `In ${category || "Word Match"}, I practiced carefully${mistakes ? ` (I corrected ${mistakes} slips)` : ""} and finished with ${pts} points.`,
      module: (name) => `Then I spent time in ${name} and paid attention to phrasing and rhythm.`,
      feltGood: ["The app still feels playful, which helps me stay consistent.", "I liked mixing structured drills with exploratory practice."],
      feltTricky: ["Sometimes I want clearer transitions so I know what to do next instantly."],
      goal: "Tomorrow I want to keep variety high and build confidence sentence by sentence.",
      moodOk: "Curious and reflective",
      moodErr: "A bit thrown off, still optimistic",
    },
  },
  {
    name: "Lucía",
    handle: "lucia",
    style: {
      titlePrefix: "I focused on clarity in",
      intro: "I slowed things down and aimed for cleaner sentences today.",
      story: (duration, lesson) => `I started with ${duration} of Story Mode and got ${lesson}, then focused on precision over speed.`,
      wordMatch: (category, mistakes, pts) => `In ${category || "Word Match"}, I corrected ${mistakes} mix-ups and still came out with ${pts} points.`,
      module: (name) => `I used ${name} to reinforce grammar patterns and confidence.`,
      feltGood: ["I felt more intentional with each answer.", "I noticed I’m translating less in my head now."],
      feltTricky: ["Some transitions still feel abrupt when switching modes.", "I want clearer reminders for daily focus words."],
      goal: "Tomorrow: keep accuracy high while adding a bit more speed.",
      moodOk: "Calm and focused",
      moodErr: "A little frustrated, still patient",
    },
  },
  {
    name: "Mateo",
    handle: "mateo",
    style: {
      titlePrefix: "I speed-ran",
      intro: "I came in with high energy and tried to chain wins quickly.",
      story: (duration, lesson) => `I fired up Story Mode (${duration}) and got ${lesson} as my opener.`,
      wordMatch: (category, mistakes, pts) => `I pushed hard in ${category || "Word Match"}${mistakes ? ` and recovered from ${mistakes} misses` : ""}, ending at ${pts} points.`,
      module: (name) => `Then I blitzed through ${name} to keep momentum hot.`,
      feltGood: ["Fast feedback keeps me locked in.", "The challenge pacing feels game-like in a good way."],
      feltTricky: ["I sometimes click too fast and make preventable mistakes."],
      goal: "Tomorrow: keep the same speed, reduce careless errors.",
      moodOk: "Hyped",
      moodErr: "Annoyed but motivated",
    },
  },
  {
    name: "Sofía",
    handle: "sofia",
    style: {
      titlePrefix: "I built confidence with",
      intro: "I treated today like a confidence session and stayed steady.",
      story: (duration, lesson) => `I warmed up with Story Mode for ${duration}, and my first challenge was ${lesson}.`,
      wordMatch: (category, mistakes, pts) => `In ${category || "Word Match"}, I stayed patient${mistakes ? ` through ${mistakes} slips` : ""} and finished on ${pts} points.`,
      module: (name) => `I followed that with ${name} and focused on speaking naturally.`,
      feltGood: ["I felt less intimidated by harder prompts.", "The mascot prompts actually kept me motivated today."],
      feltTricky: ["I still want better cues about what to tackle next."],
      goal: "Tomorrow: reuse today’s word in more complete sentences.",
      moodOk: "Encouraged",
      moodErr: "Shaky but resilient",
    },
  },
  {
    name: "Camila",
    handle: "camila",
    style: {
      titlePrefix: "I experimented with",
      intro: "I mixed modules on purpose to keep practice fresh.",
      story: (duration, lesson) => `I kicked off with a ${duration} Story Mode run and landed in ${lesson}.`,
      wordMatch: (category, mistakes, pts) => `I treated ${category || "Word Match"} like a puzzle${mistakes ? `, fixed ${mistakes} wrong turns,` : ""} and earned ${pts} points.`,
      module: (name) => `I explored ${name} next to push range and creativity.`,
      feltGood: ["Variety kept me engaged start to finish.", "I’m getting better at recovering from mistakes quickly."],
      feltTricky: ["A couple prompts still feel repetitive."],
      goal: "Tomorrow: keep variety, but spend longer on one difficult module.",
      moodOk: "Playful and curious",
      moodErr: "Slightly thrown off",
    },
  },
];

const PRACTICE_MODULES = ["Word Match", "Flashcards", "Fill in the Blank", "Sentence Scramble", "Transcription", "Scenario Builder"];
const STORY_DURATIONS = ["5 min", "15 min"];
const KNOWN_TRANSLATIONS = {
  hello: "hola",
  goodbye: "adiós",
  "good morning": "buenos días",
  "good night": "buenas noches",
  "thank you": "gracias",
  please: "por favor",
  yes: "sí",
  no: "no",
  "excuse me": "perdón",
  sorry: "lo siento",
  one: "uno",
  two: "dos",
  three: "tres",
  four: "cuatro",
  five: "cinco",
  six: "seis",
  seven: "siete",
  eight: "ocho",
  nine: "nueve",
  ten: "diez",
  red: "rojo",
  blue: "azul",
  green: "verde",
  yellow: "amarillo",
  black: "negro",
  white: "blanco",
  orange: "naranja",
  purple: "morado",
  pink: "rosa",
  brown: "marrón",
  apple: "manzana",
  bread: "pan",
  water: "agua",
  milk: "leche",
  chicken: "pollo",
  rice: "arroz",
  "fish (food)": "pescado",
  egg: "huevo",
  cheese: "queso",
  coffee: "café",
};

const outRoot = path.resolve(process.cwd(), "blog");
const draftDir = path.join(outRoot, "drafts");
const reportDir = path.join(outRoot, "reports");
const execFile = promisify(execFileCb);
const AUTO_PUBLISH = process.env.STUDENT_AUTO_PUBLISH !== "0";
const AUTO_PUBLISH_REMOTE = process.env.STUDENT_AUTO_PUBLISH_REMOTE || "origin";
const AUTO_PUBLISH_BRANCH = process.env.STUDENT_AUTO_PUBLISH_BRANCH || "main";
const REQUESTED_PERSONA = (process.env.STUDENT_PERSONA || "").trim().toLowerCase();

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sample(arr, count) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}

function normalizeText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function ensureDirs() {
  await fs.mkdir(draftDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });
}

async function runGit(args) {
  return execFile("git", args, { cwd: process.cwd() });
}

async function autoPublishDraftAndReport(stamp, fileSuffix) {
  if (!AUTO_PUBLISH) return { ok: false, skipped: true, reason: "disabled" };

  const draftRel = path.posix.join("blog", "drafts", `${stamp}-${fileSuffix}.md`);
  const reportRel = path.posix.join("blog", "reports", `${stamp}-${fileSuffix}.json`);

  await runGit(["rev-parse", "--is-inside-work-tree"]);
  await runGit(["add", draftRel, reportRel]);

  const { stdout: statusOut } = await runGit(["status", "--porcelain", "--", draftRel, reportRel]);
  if (!String(statusOut || "").trim()) {
    return { ok: true, skipped: true, reason: "no_changes" };
  }

  await runGit(["commit", "-m", `chore(blog): add synthetic student draft ${stamp} (${fileSuffix})`]);
  await runGit(["push", AUTO_PUBLISH_REMOTE, AUTO_PUBLISH_BRANCH]);
  return { ok: true, skipped: false, remote: AUTO_PUBLISH_REMOTE, branch: AUTO_PUBLISH_BRANCH };
}

async function gotoAnyBaseUrl(page, notes) {
  let lastError = null;

  for (const candidate of BASE_URL_CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await page.goto(candidate, { waitUntil: "domcontentloaded", timeout: 60000 });
        notes.push(`Opened site successfully: ${candidate}`);
        return candidate;
      } catch (e) {
        lastError = e;
        notes.push(`Base URL failed (attempt ${attempt}): ${candidate} → ${e?.message || e}`);
      }
    }
  }

  throw lastError || new Error("Unable to reach any configured base URL");
}

async function dismissDailyLaunchIfPresent(page) {
  const startBtn = page.getByRole("button", { name: /Start Learning/i });
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function waitForDashboardReady(page, timeout = 12000) {
  await dismissDailyLaunchIfPresent(page);
  const markers = [
    page.getByText("Guided Learning Path", { exact: true }),
    page.getByText("Daily Quests", { exact: true }),
    page.getByText("Learning Progress", { exact: true }),
    page.getByRole("button", { name: /Take on the Challenge/i }),
  ];

  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const m of markers) {
      if (await m.isVisible().catch(() => false)) return true;
    }
    await dismissDailyLaunchIfPresent(page);
    await page.waitForTimeout(200);
  }
  throw new Error("Dashboard did not become ready in time");
}

async function safeClickButton(page, nameMatcher, timeout = 12000) {
  const btn = page.getByRole("button", { name: nameMatcher }).first();
  await dismissDailyLaunchIfPresent(page);
  await btn.waitFor({ timeout });
  try {
    await btn.click({ timeout });
  } catch {
    await dismissDailyLaunchIfPresent(page);
    await btn.click({ timeout, force: true });
  }
}

async function returnToDashboard(page) {
  const backBtn = page.getByRole("button", { name: "← Back" });
  const dashboardBtn = page.getByRole("button", { name: "Back to Dashboard" });

  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click({ timeout: 10000 });
  } else if (await dashboardBtn.isVisible().catch(() => false)) {
    await dashboardBtn.click({ timeout: 10000 });
  }

  await waitForDashboardReady(page);
}

async function completeWordMatchForPoints(page) {
  await page.getByText("Match English", { exact: false }).waitFor({ timeout: 10000 });

  const availableCategories = await page.locator("select option").allTextContents().catch(() => []);
  const preferred = ["Numbers", "Greetings", "Colors", "Food"];
  const shuffled = sample(preferred, preferred.length);
  const targetCategory = shuffled.find((c) => availableCategories.some((opt) => normalizeText(opt) === normalizeText(c)));
  if (targetCategory) {
    await page.locator("select").first().selectOption({ label: targetCategory }).catch(() => {});
    await page.waitForTimeout(350);
  }

  const pairs = await page.evaluate((known) => {
    const norm = (v) =>
      String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const headings = [...document.querySelectorAll("div")];
    const enHead = headings.find((d) => norm(d.textContent) === "english");
    const esHead = headings.find((d) => norm(d.textContent) === "espanol");
    const enCol = enHead?.parentElement;
    const esCol = esHead?.parentElement;

    const left = [...(enCol?.querySelectorAll("button") || [])].map((b) => (b.textContent || "").trim()).filter(Boolean);
    const right = [...(esCol?.querySelectorAll("button") || [])].map((b) => (b.textContent || "").trim()).filter(Boolean);
    const rightNorm = new Set(right.map(norm));

    return left
      .map((en) => {
        const mapped = known[norm(en)] || null;
        return mapped && rightNorm.has(norm(mapped)) ? { en, es: mapped } : null;
      })
      .filter(Boolean);
  }, KNOWN_TRANSLATIONS);

  const plannedMistakes = Math.floor(Math.random() * 4);
  let mistakesMade = 0;

  for (const pair of pairs) {
    const shouldMakeMistake = mistakesMade < plannedMistakes && Math.random() < 0.65;

    if (shouldMakeMistake) {
      const wrongSpanish = await page.evaluate((expected) => {
        const norm = (v) =>
          String(v || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
        const headings = [...document.querySelectorAll("div")];
        const esHead = headings.find((d) => norm(d.textContent) === "espanol");
        const esCol = esHead?.parentElement;
        const options = [...(esCol?.querySelectorAll("button") || [])]
          .map((b) => (b.textContent || "").trim())
          .filter(Boolean);
        return options.find((opt) => norm(opt) !== norm(expected)) || null;
      }, pair.es);

      if (wrongSpanish) {
        await page.getByRole("button", { name: pair.en, exact: false }).first().click({ timeout: 5000 });
        await page.getByRole("button", { name: wrongSpanish, exact: false }).first().click({ timeout: 5000 });
        mistakesMade += 1;
        await page.waitForTimeout(900);
      }
    }

    await page.getByRole("button", { name: pair.en, exact: false }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: pair.es, exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(140);
  }

  await page.waitForTimeout(500);
  await returnToDashboard(page);
  return { mistakesMade, targetCategory: targetCategory || null };
}

function choosePersona() {
  if (!REQUESTED_PERSONA) return pick(STUDENT_PERSONAS);
  const found = STUDENT_PERSONAS.find(
    (p) => p.handle.toLowerCase() === REQUESTED_PERSONA || p.name.toLowerCase() === REQUESTED_PERSONA,
  );
  return found || pick(STUDENT_PERSONAS);
}

function personaPacing(handle = '') {
  const map = {
    diego: { moduleMin: 16, moduleMax: 28, risk: 0.75 },
    maria: { moduleMin: 12, moduleMax: 22, risk: 0.35 },
    lucia: { moduleMin: 10, moduleMax: 20, risk: 0.25 },
    mateo: { moduleMin: 18, moduleMax: 30, risk: 0.85 },
    sofia: { moduleMin: 11, moduleMax: 21, risk: 0.4 },
    camila: { moduleMin: 14, moduleMax: 26, risk: 0.55 },
  };
  return map[handle] || { moduleMin: 10, moduleMax: 20, risk: 0.5 };
}

async function runSession() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const startedAt = new Date().toISOString();
  const notes = [];
  const blogHighlights = [];
  let status = "ok";
  let error = null;
  let activeBaseUrl = PRIMARY_BASE_URL;
  let simulatedScore = 0;
  let simulatedLessonsCompleted = 0;

  const persona = choosePersona();
  const voice = getPersonaStyle(persona.name);
  const pacing = personaPacing(persona.handle);
  const username = `${persona.handle}_${Date.now().toString().slice(-6)}`;

  try {
    activeBaseUrl = await gotoAnyBaseUrl(page, notes);

    await page.getByRole("button", { name: "Register" }).click();
    const inputs = page.locator("input");
    await inputs.nth(0).fill(username);
    await inputs.nth(1).fill("testpass123");
    await page.getByRole("button", { name: "Create Account →" }).click();
    await waitForDashboardReady(page, 20000);

    blogHighlights.push(voice.intro);

    const chosenDuration = pick(STORY_DURATIONS);
    try {
      await safeClickButton(page, /Take on the Challenge/i, 15000);
      await page.getByRole("button", { name: /Start Story Mode/i }).waitFor({ timeout: 15000 });
      await safeClickButton(page, new RegExp(`^${chosenDuration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), 10000);
      await safeClickButton(page, /Start Story Mode/i, 10000);

      const lessonHeader = (
        await page
          .locator("text=Flashcards, text=Word Match, text=Fill in the Blank, text=Sentence Scramble, text=Transcription, text=Scenario Builder, text=Placement Test")
          .first()
          .textContent()
          .catch(() => "a challenge")
      ).trim();

      blogHighlights.push(voice.story(chosenDuration, lessonHeader));
      await returnToDashboard(page);
    } catch (storyModeError) {
      notes.push(`Story Mode unavailable, continuing with practice modules: ${storyModeError?.message || storyModeError}`);
      await returnToDashboard(page).catch(() => {});
    }

    const extraModules = sample(
      PRACTICE_MODULES.filter((m) => m !== "Word Match"),
      Math.floor(Math.random() * 3) + 1,
    );
    const dailyModules = ["Word Match", ...extraModules];

    for (const moduleName of dailyModules) {
      try {
        await safeClickButton(page, new RegExp(moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), 10000);
        await page.waitForTimeout(1200);

        if (moduleName === "Word Match") {
          const wm = await completeWordMatchForPoints(page);
          const categoryText = await page.locator("select").first().inputValue().catch(() => null);
          const volatility = Math.round((Math.random() - 0.5) * 10 * pacing.risk);
          const wmPoints = Math.max(12, 40 + pacing.moduleMin - (Number(wm?.mistakesMade) || 0) * 5 + volatility);
          simulatedScore += wmPoints;
          simulatedLessonsCompleted += 1;
          const label = categoryText ? `${moduleName} (${categoryText})` : moduleName;
          blogHighlights.push(voice.wordMatch(label, Number(wm?.mistakesMade) || 0, wmPoints));
        } else {
          const modulePoints = Math.max(
            8,
            Math.round(pacing.moduleMin + Math.random() * (pacing.moduleMax - pacing.moduleMin) + (Math.random() < pacing.risk ? 4 : 0))
          );
          simulatedScore += modulePoints;
          simulatedLessonsCompleted += 1;
          blogHighlights.push(`${voice.module(moduleName)} I picked up ${modulePoints} pts here.`);
          await returnToDashboard(page);
        }
      } catch (moduleError) {
        notes.push(`Module skipped (${moduleName}): ${moduleError?.message || moduleError}`);
        if (moduleName === "Word Match") {
          const fallbackPts = Math.max(8, Math.round(pacing.moduleMin * 0.75 + Math.random() * 8));
          simulatedScore += fallbackPts;
          simulatedLessonsCompleted += 1;
          blogHighlights.push(`${voice.wordMatch(moduleName, 0, fallbackPts)} I had some UI hiccups but still logged progress.`);
        }
        await returnToDashboard(page).catch(() => {});
      }
    }
  
    notes.push(`Session score estimate: ${simulatedScore} points across ${simulatedLessonsCompleted} completed lessons.`);
  } catch (e) {
    status = "error";
    error = e?.message || String(e);
    notes.push(`Encountered issue: ${error}`);
  }

  await browser.close();
  const endedAt = new Date().toISOString();

  return {
    startedAt,
    endedAt,
    baseUrl: activeBaseUrl,
    username,
    studentName: persona.name,
    status,
    notes,
    blogHighlights,
    score: simulatedScore,
    lessonsCompleted: simulatedLessonsCompleted,
    error,
  };
}

function getPersonaStyle(name) {
  const p = STUDENT_PERSONAS.find((x) => x.name === name);
  return p?.style || {
    titlePrefix: "I practiced",
    intro: "I logged in and got right into practice.",
    story: (duration, lesson) => `I started Story Mode (${duration}) and got ${lesson}.`,
    wordMatch: (category, mistakes, pts) => `I completed ${category || "Word Match"}${mistakes ? ` with ${mistakes} mistakes corrected` : ""} and got ${pts} points.`,
    module: (name) => `I spent time in ${name}.`,
    feltGood: ["The app felt smooth and motivating today."],
    feltTricky: ["I want clearer guidance between modules."],
    goal: "Keep the streak going with one deeper lesson tomorrow.",
    moodOk: "Motivated",
    moodErr: "Trying to stay positive",
  };
}

function buildPostTitle(report, date) {
  const highlights = (report.blogHighlights || []).map((h) => String(h).toLowerCase());
  const topics = [];
  if (highlights.some((h) => h.includes("story mode"))) topics.push("Story Mode");
  if (highlights.some((h) => h.includes("word match"))) topics.push("Word Match");

  const moduleNames = ["Flashcards", "Fill in the Blank", "Sentence Scramble", "Transcription", "Scenario Builder"];
  for (const m of moduleNames) {
    if (highlights.some((h) => h.includes(m.toLowerCase()))) topics.push(m);
  }

  const unique = [...new Set(topics)].slice(0, 3);
  const style = getPersonaStyle(report.studentName);
  if (!unique.length) return `${style.titlePrefix} Spanish and stayed consistent — ${date}`;
  if (unique.length === 1) return `${style.titlePrefix} ${unique[0]} today — ${date}`;
  if (unique.length === 2) return `${style.titlePrefix} ${unique[0]} and ${unique[1]} — ${date}`;
  return `${style.titlePrefix} ${unique[0]}, ${unique[1]}, and ${unique[2]} — ${date}`;
}

function toMarkdown(report) {
  const date = todayStamp();
  const voice = getPersonaStyle(report.studentName);
  const mood = report.status === "ok" ? voice.moodOk : voice.moodErr;
  const highlights = (report.blogHighlights || []).map((n) => `- ${n}`).join("\n") || "- I checked in and did a short practice session.";
  const when = report?.startedAt ? new Date(report.startedAt).toLocaleString("en-CA") : "Unknown";
  const feltGood = sample(voice.feltGood || [], Math.min(2, (voice.feltGood || []).length));
  const feltTricky = sample(voice.feltTricky || [], Math.min(2, (voice.feltTricky || []).length));

  return `# ${buildPostTitle(report, date)}\n\n`
    + `**Date & Time:** ${when}  \n`
    + `**Score:** ${Number(report?.score) || 0} points  \n`
    + `**Lessons Completed:** ${Number(report?.lessonsCompleted) || 0}  \n`
    + `**Mood:** ${mood}\n\n`
    + `## What I worked on\n${highlights}\n\n`
    + `## What felt good\n${(feltGood.length ? feltGood : ["I found a good rhythm today."]).map((x) => `- ${x}`).join("\n")}\n\n`
    + `## What felt tricky\n${(feltTricky.length ? feltTricky : ["A few prompts still slowed me down."]).map((x) => `- ${x}`).join("\n")}\n\n`
    + `## My goal for tomorrow\n- ${voice.goal}\n`
    + (report.status === "error"
      ? `\n## What got in the way\n- I hit a technical issue partway through and had to stop early.\n`
      : "");
}

async function main() {
  await ensureDirs();
  const report = await runSession();
  const stamp = todayStamp();
  const fileSuffix = String(report.studentName || "student")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "student";
  const reportPath = path.join(reportDir, `${stamp}-${fileSuffix}.json`);
  const draftPath = path.join(draftDir, `${stamp}-${fileSuffix}.md`);

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  await fs.writeFile(draftPath, toMarkdown(report));

  try {
    const publishResult = await autoPublishDraftAndReport(stamp, fileSuffix);
    if (publishResult.skipped && publishResult.reason === "disabled") {
      console.log("Auto-publish: disabled (set STUDENT_AUTO_PUBLISH=1 to enable).");
    } else if (publishResult.skipped && publishResult.reason === "no_changes") {
      console.log("Auto-publish: no changes to commit.");
    } else if (publishResult.ok) {
      console.log(`Auto-publish: pushed draft/report to ${publishResult.remote}/${publishResult.branch}.`);
    }
  } catch (e) {
    report.status = "error";
    report.error = `Auto-publish failed: ${e?.message || String(e)}`;
    report.notes.push(`Auto-publish failed: ${e?.message || String(e)}`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    await fs.writeFile(draftPath, toMarkdown(report));
  }

  console.log(`Synthetic student run complete: ${report.status}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Draft:  ${draftPath}`);
  if (report.error) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
