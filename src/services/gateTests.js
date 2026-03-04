import { GATE_POLICY_V1, GATE_SECTION_KEYS, gateKeyFromLevel } from "../config/gates.js";

function nowIso(ts = Date.now()) {
  return new Date(ts).toISOString();
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function getGateForLevel(level, gatePolicy = GATE_POLICY_V1) {
  const lvl = Number(level);
  if (!Number.isFinite(lvl)) return null;
  return (gatePolicy?.gateLevels || []).find((g) => Number(g?.level) === lvl) || null;
}

export function isGateRequiredForNextLevel(profile = {}, nextLevel, gatePolicy = GATE_POLICY_V1) {
  const gate = getGateForLevel(nextLevel, gatePolicy);
  if (!gate) return { required: false, gate: null, gateKey: null, passed: true };

  const gateKey = gateKeyFromLevel(nextLevel);
  const state = profile?.gates?.[gateKey] || null;
  const passed = state?.status === "passed";

  return { required: true, gate, gateKey, passed, state };
}

export function unlockGate(profile = {}, gateKey, gateType, now = Date.now()) {
  const gates = { ...(profile?.gates || {}) };
  const prev = gates[gateKey] || {};

  gates[gateKey] = {
    status: prev?.status === "passed" ? "passed" : "available",
    type: gateType || prev?.type || "checkpoint",
    attempts: safeNumber(prev?.attempts, 0),
    bestScorePct: safeNumber(prev?.bestScorePct, 0),
    lastScorePct: safeNumber(prev?.lastScorePct, 0),
    sectionBest: { vocab: 0, grammar: 0, listening: 0, production: 0, ...(prev?.sectionBest || {}) },
    unlockedAt: prev?.unlockedAt || nowIso(now),
    lastAttemptAt: prev?.lastAttemptAt || null,
    nextEligibleAt: prev?.nextEligibleAt || null,
    passedAt: prev?.passedAt || null,
    weakAreas: Array.isArray(prev?.weakAreas) ? prev.weakAreas : [],
    history: Array.isArray(prev?.history) ? prev.history : [],
  };

  return { ...profile, gates };
}

export function canAttemptGate(profile = {}, gateKey, now = Date.now()) {
  const state = profile?.gates?.[gateKey];
  if (!state) return { allowed: false, reason: "not_unlocked" };
  if (state.status === "passed") return { allowed: false, reason: "already_passed" };

  const nextEligibleMs = state?.nextEligibleAt ? new Date(state.nextEligibleAt).getTime() : 0;
  if (nextEligibleMs && now < nextEligibleMs) {
    return { allowed: false, reason: "cooldown", nextEligibleAt: state.nextEligibleAt };
  }

  return { allowed: true };
}

function pickRuleForGateType(gateType, gatePolicy = GATE_POLICY_V1) {
  return gatePolicy?.rulesByType?.[gateType] || gatePolicy?.rulesByType?.checkpoint;
}

/**
 * TODO: wire `resolver` to generate true question objects by section.
 * For now this produces placeholder shell questions with stable IDs.
 */
function generateQuestions({ level, gateType, rule, resolver }) {
  const questions = [];
  const composition = Array.isArray(rule?.composition) ? rule.composition : [];

  for (const block of composition) {
    const section = block?.section;
    const count = safeNumber(block?.count, 0);
    for (let i = 0; i < count; i += 1) {
      questions.push({
        qid: `${gateType}:${level}:${section}:${i + 1}`,
        section,
        type: section,
        prompt: `TODO ${section} prompt #${i + 1}`,
        options: [],
        // Keep answerKey empty in scaffold. Fill at generation time.
        answerKey: null,
        meta: { level, gateType },
      });
    }
  }

  return questions;
}

export function createGateAttempt({ profile = {}, gateKey, level, gateType, resolver, now = Date.now(), gatePolicy = GATE_POLICY_V1 }) {
  const rule = pickRuleForGateType(gateType, gatePolicy);
  const attemptId = `gate_${gateKey}_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = now;
  const expiresAt = safeNumber(rule?.timed ? startedAt + safeNumber(rule?.timeLimitSec, 0) * 1000 : 0, 0);

  const questions = generateQuestions({ level, gateType, rule, resolver });

  return {
    attemptId,
    gateKey,
    gateType,
    level,
    startedAt,
    expiresAt: expiresAt || null,
    questions,
    blueprintVersion: 1,
  };
}

function scoreBySection(questions = [], answers = {}) {
  const bySection = {};

  for (const q of questions) {
    const section = q?.section || "misc";
    if (!bySection[section]) bySection[section] = { total: 0, correct: 0 };

    bySection[section].total += 1;

    // Scaffold behavior:
    // - if answers[qid] is {correct:boolean}, use it
    // - else if boolean, use it
    // - else false
    const a = answers?.[q?.qid];
    const isCorrect = typeof a === "boolean" ? a : !!a?.correct;
    if (isCorrect) bySection[section].correct += 1;
  }

  const sectionScores = {};
  Object.entries(bySection).forEach(([section, s]) => {
    sectionScores[section] = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  });

  return { bySection, sectionScores };
}

export function gradeGateAttempt({ attempt, answers = {}, gateRule }) {
  const rule = gateRule || pickRuleForGateType(attempt?.gateType);
  const questions = Array.isArray(attempt?.questions) ? attempt.questions : [];

  const { bySection, sectionScores } = scoreBySection(questions, answers);

  let weighted = 0;
  const weights = rule?.sectionWeights || {};
  GATE_SECTION_KEYS.forEach((k) => {
    const pct = safeNumber(sectionScores[k], 0);
    const w = safeNumber(weights[k], 0);
    weighted += pct * w;
  });

  const scorePct = clamp(Math.round(weighted), 0, 100);
  const passScorePct = safeNumber(rule?.passScorePct, 75);
  const minSectionPct = safeNumber(rule?.minSectionPct, 60);

  const failReasons = [];
  if (scorePct < passScorePct) failReasons.push("total_below_threshold");

  GATE_SECTION_KEYS.forEach((section) => {
    const sectionPct = safeNumber(sectionScores[section], 0);
    if ((bySection[section]?.total || 0) > 0 && sectionPct < minSectionPct) {
      failReasons.push(`${section}_below_min`);
    }
  });

  const weakAreas = GATE_SECTION_KEYS.filter((s) => {
    const seen = (bySection[s]?.total || 0) > 0;
    return seen && safeNumber(sectionScores[s], 0) < minSectionPct;
  });

  const passed = failReasons.length === 0;

  return {
    scorePct,
    sectionScores,
    passed,
    failReasons,
    weakAreas,
  };
}

function resolveAssistAdjustment({ attempts = 0, gatePolicy = GATE_POLICY_V1 }) {
  const ladder = Array.isArray(gatePolicy?.assistLadder) ? gatePolicy.assistLadder : [];
  const active = ladder
    .filter((a) => safeNumber(attempts, 0) >= safeNumber(a?.afterFailures, Infinity))
    .sort((a, b) => safeNumber(b?.afterFailures, 0) - safeNumber(a?.afterFailures, 0))[0];
  return active || null;
}

export function finalizeGateAttempt({ profile = {}, gateKey, attemptResult, gatePolicy = GATE_POLICY_V1, now = Date.now() }) {
  const gates = { ...(profile?.gates || {}) };
  const prev = gates[gateKey] || {};

  const attempts = safeNumber(prev?.attempts, 0) + 1;
  const wasPassedBefore = prev?.status === "passed";
  const passedNow = !!attemptResult?.passed;
  const bestScorePct = Math.max(safeNumber(prev?.bestScorePct, 0), safeNumber(attemptResult?.scorePct, 0));

  const sectionBest = { vocab: 0, grammar: 0, listening: 0, production: 0, ...(prev?.sectionBest || {}) };
  for (const k of GATE_SECTION_KEYS) {
    sectionBest[k] = Math.max(safeNumber(sectionBest[k], 0), safeNumber(attemptResult?.sectionScores?.[k], 0));
  }

  const assist = passedNow ? null : resolveAssistAdjustment({ attempts, gatePolicy });
  const cooldownMin = safeNumber(assist?.cooldownMin, safeNumber(gatePolicy?.defaultCooldownMin, 30));
  const nextEligibleAt = passedNow ? null : nowIso(now + cooldownMin * 60 * 1000);

  const history = [...(Array.isArray(prev?.history) ? prev.history : [])];
  history.push({
    attemptId: attemptResult?.attemptId || `attempt_${now}`,
    scorePct: safeNumber(attemptResult?.scorePct, 0),
    sectionScores: attemptResult?.sectionScores || {},
    passed: passedNow,
    startedAt: attemptResult?.startedAt || null,
    submittedAt: nowIso(now),
    durationSec: safeNumber(attemptResult?.durationSec, 0),
  });

  gates[gateKey] = {
    ...prev,
    status: wasPassedBefore || passedNow ? "passed" : "available",
    attempts,
    bestScorePct,
    lastScorePct: safeNumber(attemptResult?.scorePct, 0),
    sectionBest,
    lastAttemptAt: nowIso(now),
    nextEligibleAt,
    passedAt: wasPassedBefore ? prev?.passedAt : passedNow ? nowIso(now) : null,
    weakAreas: Array.isArray(attemptResult?.weakAreas) ? attemptResult.weakAreas : [],
    history: history.slice(-20),
  };

  const certifiedLevels = new Set(Array.isArray(profile?.certifiedLevels) ? profile.certifiedLevels : []);
  if (wasPassedBefore || passedNow) certifiedLevels.add(gateKey);

  return {
    profile: {
      ...profile,
      gates,
      certifiedLevels: [...certifiedLevels],
      activeGateAttempt: null,
      gateVersion: gatePolicy?.version || 1,
    },
    assist,
  };
}

export function buildRecoveryPlan({ weakAreas = [], profile = {}, resolver }) {
  const areas = Array.isArray(weakAreas) ? weakAreas : [];
  const missions = [];

  if (areas.includes("listening")) {
    missions.push({ module: "Transcription", count: 2, goal: ">=75%" });
    missions.push({ module: "Audio Shadowing", count: 1, goal: "complete" });
  }

  if (areas.includes("production")) {
    missions.push({ module: "Sentence Scramble", count: 2, goal: ">=80%" });
    missions.push({ module: "Fill in the Blank", count: 1, goal: ">=75%" });
  }

  if (areas.includes("grammar")) {
    missions.push({ module: "Learn Verbs", count: 2, goal: ">=75%" });
    missions.push({ module: "Speed Round", count: 1, goal: "complete" });
  }

  if (areas.includes("vocab")) {
    missions.push({ module: "Flashcards", count: 2, goal: ">=80%" });
    missions.push({ module: "Word Match", count: 1, goal: ">=80%" });
  }

  // Fallback if no weak areas were classified.
  if (!missions.length) {
    missions.push({ module: "Flashcards", count: 1, goal: ">=80%" });
    missions.push({ module: "Fill in the Blank", count: 1, goal: ">=75%" });
  }

  return {
    title: `Recovery Path: ${areas.length ? areas.join(" + ") : "Core Review"}`,
    weakAreas: areas,
    missions,
    estimatedMin: clamp(missions.length * 5, 8, 25),
  };
}
