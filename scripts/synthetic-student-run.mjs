import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.STUDENT_BASE_URL || "https://chadlingo.com";
const outRoot = path.resolve(process.cwd(), "blog");
const draftDir = path.join(outRoot, "drafts");
const reportDir = path.join(outRoot, "reports");

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureDirs() {
  await fs.mkdir(draftDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });
}

async function runSession() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const startedAt = new Date().toISOString();
  const notes = [];
  let status = "ok";
  let error = null;

  const username = `studentbot_${Date.now().toString().slice(-8)}`;

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    notes.push("Opened site successfully.");

    await page.getByRole("button", { name: "Register" }).click();
    const inputs = page.locator("input");
    await inputs.nth(0).fill(username);
    await inputs.nth(1).fill("testpass123");
    await page.getByRole("button", { name: "Create Account →" }).click();
    await page.getByText("Adaptive Path", { exact: true }).waitFor({ timeout: 15000 });
    notes.push("Registered and reached dashboard.");

    await page.getByRole("button", { name: "Take on the Challenge" }).click();
    await page.getByText("Story Mode", { exact: false }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "5 min" }).click();
    await page.getByRole("button", { name: "🚀 Start Story Mode" }).click();

    const lessonHeader = (await page.locator("text=Flashcards, text=Word Match, text=Fill in the Blank, text=Sentence Scramble, text=Transcription, text=Scenario Builder, text=Placement Test").first().textContent().catch(() => "Lesson")).trim();
    notes.push(`Started Story Mode and entered challenge: ${lessonHeader}.`);

    await page.getByRole("button", { name: "← Back" }).click();
    await page.getByText("Adaptive Path", { exact: true }).waitFor({ timeout: 10000 });

    await page.getByRole("button", { name: "Word Match" }).first().click();
    await page.getByText("WordMatch", { exact: false }).waitFor({ timeout: 10000 });
    const categoryText = await page.locator("select").first().inputValue().catch(() => "(none)");
    notes.push(`Opened Word Match. Auto-selected category: ${categoryText}.`);
  } catch (e) {
    status = "error";
    error = e?.message || String(e);
    notes.push(`Encountered issue: ${error}`);
  }

  await browser.close();
  const endedAt = new Date().toISOString();

  return { startedAt, endedAt, baseUrl: BASE_URL, username, status, notes, error };
}

function toMarkdown(report) {
  const date = todayStamp();
  const title = `Synthetic Student Diary — ${date}`;
  const mood = report.status === "ok" ? "Curious and motivated" : "A little frustrated but hopeful";
  const highlights = report.notes.map((n) => `- ${n}`).join("\n");

  return `# ${title}\n\n` +
`**Student:** ${report.username}  \n` +
`**Session Date:** ${date}  \n` +
`**Environment:** ${report.baseUrl}  \n` +
`**Mood:** ${mood}  \n` +
`**Status:** ${report.status.toUpperCase()}\n\n` +
`## What I did\n${highlights}\n\n` +
`## What felt good\n- The app flow feels fast and game-like.\n- Story Mode instantly creates motivation.\n\n` +
`## What felt confusing\n- I still want clearer “what to do next” prompts in each module.\n\n` +
`## Suggestion for tomorrow\n- Add one tiny “Daily Mission” sentence on dashboard after login.\n\n` +
`## Debug Note\n${report.error ? `- Error: ${report.error}` : "- No blocking issues in this run."}\n`;
}

async function main() {
  await ensureDirs();
  const report = await runSession();
  const stamp = todayStamp();
  const reportPath = path.join(reportDir, `${stamp}.json`);
  const draftPath = path.join(draftDir, `${stamp}.md`);

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  await fs.writeFile(draftPath, toMarkdown(report));

  console.log(`Synthetic student run complete: ${report.status}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Draft:  ${draftPath}`);
  if (report.error) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
