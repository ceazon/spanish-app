// Spanish-app/src/services/learningPath.js

/**
 * Learning Path Engine (A1-A2 MVP)
 *
 * Purpose:
 * - Define a structured program from A1 -> A2
 * - Remove "what should I do next?" friction
 * - Generate a guided daily plan from user progression state
 */

const MODULES = {
  INTRO: "Flashcards",
  RECOGNITION: "Word Match",
  PRODUCTION: "Fill in the Blank",
  APPLICATION: "Scenario Builder",
};

export const PATH_BANDS = ["A1", "A2"];
export const SUBLEVELS_PER_BAND = 10;

/**
 * Structured path definition by sub-level role.
 * We keep this data-driven so it can evolve without changing orchestration logic.
 */
export const LEARNING_PATH = {
  A1: Array.from({ length: SUBLEVELS_PER_BAND }, (_, i) => ({
    band: "A1",
    sublevel: i,
    title: i < 3 ? `Foundations ${i + 1}` : i < 7 ? `Core Communication ${i + 1}` : `Confidence Building ${i + 1}`,
    focus: i < 3 ? "Foundations" : i < 7 ? "Core Communication" : "Confidence Building",
    moduleSequence: [
      MODULES.INTRO,
      MODULES.RECOGNITION,
      MODULES.PRODUCTION,
    ],
    completionRules: {
      masteryTarget: 0.8,          // 80% of words in this bucket mastered
      requiredProductionRuns: 1,   // at least one production step completed
    },
  })),

  A2: Array.from({ length: SUBLEVELS_PER_BAND }, (_, i) => ({
    band: "A2",
    sublevel: i,
    title: i < 3 ? `Everyday Expansion ${i + 1}` : i < 7 ? `Narration & Context ${i + 1}` : `Fluency Bridge ${i + 1}`,
    focus: i < 3 ? "Everyday Expansion" : i < 7 ? "Narration & Context" : "Fluency Bridge",
    moduleSequence: [
      MODULES.INTRO,
      MODULES.RECOGNITION,
      MODULES.PRODUCTION,
      MODULES.APPLICATION,
    ],
    completionRules: {
      masteryTarget: 0.8,
      requiredProductionRuns: 1,
    },
  })),
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function resolveBandSublevel(profile = {}) {
  const band = profile?.cefrBand || "A1";
  const sub = clamp(Number(profile?.sublevel || 0), 0, SUBLEVELS_PER_BAND - 1);
  return { band, sublevel: sub };
}

export function getPathNode(profile = {}) {
  const { band, sublevel } = resolveBandSublevel(profile);
  const node = LEARNING_PATH?.[band]?.[sublevel] || LEARNING_PATH.A1[0];
  return node;
}

/**
 * Build a guided plan for "today".
 * - deterministic structure
 * - can later adapt based on weak areas / fatigue / streak
 */
function randomizeStepSequence(base = []) {
  if (!Array.isArray(base) || !base.length) return [];
  const first = base[0]; // keep intro first
  const rest = [...base.slice(1)];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

export function buildDailyPlan(profile = {}, now = new Date()) {
  const node = getPathNode(profile);
  const date = todayKey(now);
  const sequence = randomizeStepSequence(node.moduleSequence);

  return {
    date,
    band: node.band,
    sublevel: node.sublevel,
    focus: node.focus,
    steps: sequence.map((moduleType, index) => ({
      id: `${date}:${node.band}:${node.sublevel}:${index}`,
      moduleType,
      index,
      status: "pending", // pending | done
    })),
  };
}

/**
 * Ensure profile has path state.
 */
export function ensurePathState(profile = {}, now = new Date()) {
  const p = { ...profile };
  const date = todayKey(now);

  if (!p.pathState || p.pathState.date !== date) {
    p.pathState = {
      ...buildDailyPlan(p, now),
      lastUpdatedAt: new Date(now).toISOString(),
    };
  }

  if (!Array.isArray(p.pathHistory)) p.pathHistory = [];
  return p;
}

/**
 * Return next required module step.
 */
export function getNextPathStep(profile = {}, now = new Date()) {
  const p = ensurePathState(profile, now);
  const next = p.pathState.steps.find((s) => s.status !== "done") || null;

  return {
    profile: p,
    nextStep: next,
    plan: p.pathState,
    isPlanComplete: !next,
  };
}

/**
 * Mark a module step complete if it matches today's plan.
 */
export function completePathStep(profile = {}, moduleType, now = new Date()) {
  const p = ensurePathState(profile, now);

  // strict sequencing: complete the next pending step only
  const nextPendingIdx = p.pathState.steps.findIndex((s) => s.status !== "done");
  if (nextPendingIdx >= 0 && p.pathState.steps[nextPendingIdx].moduleType === moduleType) {
    p.pathState.steps[nextPendingIdx] = {
      ...p.pathState.steps[nextPendingIdx],
      status: "done",
      completedAt: new Date(now).toISOString(),
    };
    p.pathState.lastUpdatedAt = new Date(now).toISOString();
  }

  const allDone = p.pathState.steps.every((s) => s.status === "done");
  if (allDone) {
    p.pathHistory = [
      {
        date: p.pathState.date,
        band: p.pathState.band,
        sublevel: p.pathState.sublevel,
        completedAt: new Date(now).toISOString(),
      },
      ...(p.pathHistory || []),
    ].slice(0, 90);

    // auto-roll next daily plan for continuity
    p.pathState = {
      ...buildDailyPlan(p, new Date(now.getTime() + 1000)),
      lastUpdatedAt: new Date(now).toISOString(),
    };
  }

  return p;
}
