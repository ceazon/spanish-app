// Spanish-app/src/services/progression.js

import { getLevelLabel } from '../config/cefr.js';
import masterVocabData from '../content/cefr-vocab-master.json' with { type: 'json' };

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickRandom(arr = []) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffled(arr = []) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Upgrading to v4 for micro-level progression
export const PROFILE_SCHEMA_VERSION = 4;
const MASTER_WORDS = Array.isArray(masterVocabData?.words) ? masterVocabData.words : [];
const CEFR_COUNTS = MASTER_WORDS.reduce((acc, w) => {
  const band = w?.cefr || 'A1';
  acc[band] = (acc[band] || 0) + 1;
  return acc;
}, { A1: 1, A2: 1, B1: 1, B2: 1 });
const BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const MICRO_LEVELS_PER_BAND = 20;
const MICRO_GATE_MIN_COVERAGE = 0.6;
const MICRO_GATE_MIN_MASTERY = 0.65;
const MICRO_GATE_MIN_ACC = 0.7;
const SKILL_GATE_MIN = 55;

function normalizeExposureEntry(entry = {}) {
  const seen = Number(entry.seen || 0);
  const correct = Number(entry.correct || 0);
  return {
    seen,
    correct,
    cefr: entry.cefr || "A1",
    lastSeen: entry.lastSeen || null,
    nextReviewAt: entry.nextReviewAt || null,
    stability: Number(entry.stability || 0),
  };
}

function isMastered(entry = {}) {
  const e = normalizeExposureEntry(entry);
  if (e.seen < 3) return false;
  const acc = e.seen > 0 ? e.correct / e.seen : 0;
  return acc >= 0.7;
}

function computeBandProgressFromMastery(wordExposure = {}, band = "A1") {
  const total = Number(CEFR_COUNTS?.[band] || 1);
  const mastered = Object.values(wordExposure)
    .filter((w) => (w?.cefr || "A1") === band)
    .filter(isMastered)
    .length;
  return clamp(mastered / total, 0, 1);
}

function computeBandLearningProgress(wordExposure = {}, band = "A1") {
  const total = Number(CEFR_COUNTS?.[band] || 1);
  const seenUnique = Object.values(wordExposure)
    .filter((w) => (w?.cefr || "A1") === band)
    .filter((w) => Number(w?.seen || 0) > 0)
    .length;
  return clamp(seenUnique / total, 0, 1);
}

function bucketStretchBonus(bucket = "current") {
  if (bucket === 'stretch_same_band') return 0.5;
  if (bucket === 'stretch_next_band') return 0.8;
  return 0;
}

function bandDistance(fromBand = 'A1', toBand = 'A1') {
  const from = BAND_ORDER.indexOf(fromBand);
  const to = BAND_ORDER.indexOf(toBand);
  if (from < 0 || to < 0) return 0;
  return to - from;
}

function scoreWordProgressPoint(wr = {}, currentBand = 'A1') {
  const correct = Number(wr?.correct || 0) > 0;
  let points = correct ? 1.0 : 0.15;
  if (correct) points += bucketStretchBonus(wr?.bucket || 'current');
  const stretchByBand = bandDistance(currentBand, wr?.cefr || currentBand);
  if (correct && stretchByBand > 0) points += Math.min(0.8, 0.3 * stretchByBand);
  if (wr?.hintUsed) points -= 0.2;
  return Math.max(0.05, points);
}

function computeBandProgressFromPoints(progressPointsByBand = {}, band = 'A1') {
  const totalWords = Number(CEFR_COUNTS?.[band] || 1);
  const targetPoints = Math.max(20, Math.round(totalWords * 1.05));
  const earned = Number(progressPointsByBand?.[band] || 0);
  return clamp(earned / targetPoints, 0, 1);
}

function computeHybridBandProgress(wordExposure = {}, progressPointsByBand = {}, band = 'A1') {
  const mastery = computeBandProgressFromMastery(wordExposure, band);
  const momentum = computeBandProgressFromPoints(progressPointsByBand, band);
  return clamp((mastery * 0.7) + (momentum * 0.3), 0, 1);
}

function bucketTargetSublevel(bucket = 'current', currentSublevel = 0) {
  if (bucket === 'review') return Math.max(0, currentSublevel - 1);
  if (bucket === 'stretch_same_band' || bucket === 'stretch_next_band') return Math.min(9, currentSublevel + 1);
  return currentSublevel;
}

function scoreStrengthPoint(wr = {}) {
  const correct = Number(wr?.correct || 0) > 0;
  if (!correct) return 0.05;
  if (wr?.bucket === 'review') return 1.0;
  if (wr?.bucket === 'current') return 0.3;
  return 0.15;
}

function applyWordResults(profile, wordResults = []) {
  const nextExposure = { ...(profile.wordExposure || {}) };
  for (const wr of wordResults) {
    const id = wr?.id;
    if (!id) continue;
    const prior = normalizeExposureEntry(nextExposure[id]);
    const isCorrect = Number(wr.correct || 0) > 0;
    const stability = Math.max(0, Number(prior.stability || 0) + (isCorrect ? 1 : -1));
    const reviewDays = stability >= 5 ? 14 : stability >= 3 ? 7 : stability >= 1 ? 3 : 1;
    const nextReviewAt = new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000).toISOString();

    nextExposure[id] = {
      ...prior,
      cefr: wr.cefr || prior.cefr || profile.cefrBand || "A1",
      seen: prior.seen + Number(wr.seen || 1),
      correct: prior.correct + Number(wr.correct || 0),
      lastSeen: new Date().toISOString(),
      stability,
      nextReviewAt,
    };
  }
  return nextExposure;
}

function getWordsForMicroLevel(band = 'A1', microLevel = 0) {
  return MASTER_WORDS.filter((w) => (w?.cefr || 'A1') === band && (Number(w?.microLevel || 1) - 1) === microLevel);
}

function computeSkillGateStatus(profile = {}) {
  const s = profile?.skillMastery || {};
  const values = ['recognition', 'recall', 'listening', 'production', 'grammar'].map((k) => Number(s?.[k] || 0));
  const minSkill = values.length ? Math.min(...values) : 0;
  return {
    pass: minSkill >= SKILL_GATE_MIN,
    minSkill,
  };
}

function computeMicroGateStatus(profile = {}, band = 'A1', microLevel = 0) {
  const words = getWordsForMicroLevel(band, microLevel);
  if (!words.length) return { pass: true, coverage: 1, mastery: 1, acc: 1 };

  const exposure = profile?.wordExposure || {};
  let seenCount = 0;
  let masteredCount = 0;
  let accSum = 0;

  for (const w of words) {
    const e = normalizeExposureEntry(exposure[w.id || w.es]);
    if (e.seen > 0) seenCount += 1;
    if (isMastered(e)) masteredCount += 1;
    accSum += e.seen > 0 ? (e.correct / e.seen) : 0;
  }

  const coverage = seenCount / words.length;
  const mastery = masteredCount / words.length;
  const acc = accSum / words.length;
  const pass = coverage >= MICRO_GATE_MIN_COVERAGE && mastery >= MICRO_GATE_MIN_MASTERY && acc >= MICRO_GATE_MIN_ACC;
  return { pass, coverage, mastery, acc };
}

function appendProgressionEvent(profile, event) {
  const prev = Array.isArray(profile.progressionEvents) ? profile.progressionEvents : [];
  return [...prev, event].slice(-100);
}

function normalizeModuleResult(result = {}) {
  return {
    moduleType: result.lessonType || result.type || "Unknown",
    attemptedAt: result.attemptedAt || new Date().toISOString(),
    points: Number(result.points || 0),
    correct: Number(result.correct || 0),
    total: Number(result.total || 0),
    wordResults: Array.isArray(result.wordResults)
      ? result.wordResults.map((w) => ({
          id: w.id,
          cefr: w.cefr || "A1",
          seen: Number(w.seen || 1),
          correct: Number(w.correct || 0),
          latencyMs: typeof w.latencyMs === "number" ? w.latencyMs : undefined,
          hintUsed: !!w.hintUsed,
          bucket: w.bucket || 'current',
        }))
      : [],
  };
}

export const LESSON_POOL = [
  "Flashcards",
  "Word Match",
  "Fill in the Blank",
  "Learn Verbs",
  "Speed Round",
  "Sentence Scramble",
  "Transcription",
  "Audio Shadowing",
  "Pronunciation Coach",
  "Scenario Builder",
  "Chat Partner",
  "Image Labeling",
  "Picture Description",
  "Placement Test",
  "Dictionary Book",
];

export function defaultLearningState() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    xp: 0,
    cefrBand: "A1",
    bandProgress: 0.0, // mastery progress 0.0..1.0
    learningProgress: 0.0, // exposure progress 0.0..1.0
    level: "Newcomer I",
    levelTitle: "Newcomer I",
    nextLevelTitle: "Newcomer II",
    microLevel: 0,
    microLevelProgress: 0,
    sublevel: 0,
    sublevelProgress: 0,
    overallLevel: 1,   // 1 to 80 (A1..B2 with 20 each)
    globalDifficulty: 1,
    recentAccuracies: [],
    mastery: {},
    skillMastery: {
      recognition: 0,
      recall: 0,
      listening: 0,
      production: 0,
      grammar: 0,
    },
    wordExposure: {}, // Tracking per-word mastery
    progressPointsByBand: {}, // weighted momentum points by CEFR band
    progressionEvents: [], // rolling ledger for debugging and analytics
    strengthByLevel: {}, // reinforcement score for previous/current levels
    recommendedLessons: ["Flashcards", "Word Match", "Fill in the Blank"],
    lastLessonType: null,
    updatedAt: new Date().toISOString(),
  };
}

export function migrateUser(user) {
  if (!user) return user;
  const p = user.profile || {};

  // If already v4, just return
  if (p.schemaVersion === PROFILE_SCHEMA_VERSION) return user;

  // Legacy -> v4 migration
  const learning = {
    ...defaultLearningState(),
    ...p,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    // Map old string levels to CEFR starts
    cefrBand: p.level === "intermediate" ? "A2" : "A1",
    bandProgress: p.level === "beginner" ? 0.3 : 0.0,
    updatedAt: new Date().toISOString(),
  };

  // Set initial labels
  learning.progressPointsByBand = learning.progressPointsByBand || {};
  learning.bandProgress = computeHybridBandProgress(learning.wordExposure || {}, learning.progressPointsByBand || {}, learning.cefrBand);
  learning.learningProgress = computeBandLearningProgress(learning.wordExposure || {}, learning.cefrBand);
  const { title, nextTitle, overallLevel, sublevel, pctWithinSublevel, microLevel, pctWithinMicro } = getLevelLabel(learning.cefrBand, learning.bandProgress);
  learning.level = title;
  learning.levelTitle = title;
  learning.nextLevelTitle = nextTitle;
  learning.microLevel = microLevel;
  learning.microLevelProgress = pctWithinMicro;
  learning.sublevel = sublevel;
  learning.sublevelProgress = pctWithinSublevel;
  learning.overallLevel = overallLevel;

  return { ...user, profile: learning };
}

export function getDailyQuestState(history = [], now = new Date()) {
  const today = now.toDateString();
  const todayHistory = history.filter(h => new Date(h.date).toDateString() === today);
  const todayPts = todayHistory.reduce((s, h) => s + (h.points || 0), 0);
  const todayLessons = todayHistory.length;
  const todayListening = todayHistory.filter(h => ["Transcription", "Audio Shadowing", "Pronunciation Coach"].includes(h.type)).length;

  const quests = [
    { label: "Complete 1 lesson", done: todayLessons >= 1 },
    { label: "Earn 50 points", done: todayPts >= 50 },
    { label: "Do 1 listening lesson", done: todayListening >= 1 },
  ];

  return { quests, todayPts, todayLessons, todayListening };
}

export function placementFromScore(correct, total) {
  const pct = total > 0 ? correct / total : 0;
  // Map to CEFR starts
  const cefrBand = pct >= 0.8 ? "A2" : "A1";
  const bandProgress = pct >= 0.5 && pct < 0.8 ? 0.4 : 0.0;
  
  const { title } = getLevelLabel(cefrBand, bandProgress);

  const recommendedLessons = cefrBand === "A2"
    ? ["Scenario Builder", "Chat Partner", "Speed Round"]
    : ["Flashcards", "Word Match", "Fill in the Blank"];

  return { level: title, cefrBand, bandProgress, recommendedLessons };
}

function primarySkillForModule(moduleType = '') {
  const m = String(moduleType || '');
  if (['Flashcards', 'Word Match'].includes(m)) return 'recognition';
  if (['Fill in the Blank', 'Sentence Scramble'].includes(m)) return 'recall';
  if (['Transcription', 'Audio Shadowing', 'Pronunciation Coach'].includes(m)) return 'listening';
  if (['Scenario Builder', 'Chat Partner', 'Picture Description', 'Image Labeling'].includes(m)) return 'production';
  if (['Learn Verbs', 'Speed Round'].includes(m)) return 'grammar';
  return 'recognition';
}

export function getAdaptiveDifficulty(profile = {}, lessonType) {
  const p = profile || {};
  const base = clamp(Number(p.globalDifficulty || 1), 1, 5);
  const mastery = p.mastery?.[lessonType]?.score;
  if (typeof mastery !== "number") return base;
  if (mastery >= 85) return clamp(base + 1, 1, 5);
  if (mastery <= 45) return clamp(base - 1, 1, 5);
  return base;
}

export function updateLearningProfile(profile = {}, result = {}) {
  const p = profile.schemaVersion === PROFILE_SCHEMA_VERSION ? { ...profile } : migrateUser({ profile }).profile;
  const normalized = normalizeModuleResult(result);

  const lessonType = normalized.moduleType;
  const accuracy = normalized.total > 0 ? normalized.correct / normalized.total : 0;
  const accPct = Math.round(accuracy * 100);

  // Update Mastery
  const prior = p.mastery?.[lessonType] || { score: 50, attempts: 0 };
  const nextScore = clamp(Math.round(prior.score * 0.75 + accPct * 0.25), 0, 100);

  // Update per-word exposure and compute CEFR progress from mastered words.
  if (Array.isArray(normalized.wordResults) && normalized.wordResults.length) {
    p.wordExposure = applyWordResults(p, normalized.wordResults);
  } else {
    p.wordExposure = p.wordExposure || {};
  }

  p.progressPointsByBand = { ...(p.progressPointsByBand || {}) };
  p.strengthByLevel = { ...(p.strengthByLevel || {}) };
  const currentSubForStrength = Number(p.sublevel || 0);
  const baseProgressEarned = normalized.wordResults.reduce((sum, wr) => sum + scoreWordProgressPoint(wr, p.cefrBand), 0);
  const verbHeavyModules = new Set(['Learn Verbs', 'Speed Round']);
  const progressEarned = baseProgressEarned * (verbHeavyModules.has(lessonType) ? 0.8 : 1);
  const strengthEarned = normalized.wordResults.reduce((sum, wr) => sum + scoreStrengthPoint(wr), 0);
  p.progressPointsByBand[p.cefrBand] = Number(p.progressPointsByBand[p.cefrBand] || 0) + progressEarned;

  for (const wr of normalized.wordResults) {
    const sub = bucketTargetSublevel(wr?.bucket || 'current', currentSubForStrength);
    const key = `${p.cefrBand}:${sub}`;
    p.strengthByLevel[key] = Number(p.strengthByLevel[key] || 0) + scoreStrengthPoint(wr);
  }

  // Hybrid progression: mastery + momentum for steady forward movement.
  let computedBandProgress = computeHybridBandProgress(p.wordExposure, p.progressPointsByBand, p.cefrBand);
  // Learning progress is exposure-based so users see momentum quickly.
  p.learningProgress = computeBandLearningProgress(p.wordExposure, p.cefrBand);

  // Micro-level gating: prevent progress from crossing into next micro level
  // unless coverage+mastery+accuracy thresholds are met for current micro level.
  const currentMicro = clamp(Number.isFinite(Number(p.microLevel)) ? Number(p.microLevel) : Number((p.sublevel || 0) * 2), 0, MICRO_LEVELS_PER_BAND - 1);
  const gate = computeMicroGateStatus(p, p.cefrBand, currentMicro);
  const skillGate = computeSkillGateStatus(p);
  const gatePass = gate.pass && skillGate.pass;
  p.gateStatus = {
    microLevel: currentMicro,
    pass: gatePass,
    coverage: Math.round(gate.coverage * 100),
    mastery: Math.round(gate.mastery * 100),
    accuracy: Math.round(gate.acc * 100),
    minSkill: Math.round(skillGate.minSkill),
  };
  const nextMicroStart = (currentMicro + 1) / MICRO_LEVELS_PER_BAND;
  if (!gatePass && computedBandProgress >= nextMicroStart) {
    computedBandProgress = Math.max(0, nextMicroStart - 0.001);
  }
  p.bandProgress = computedBandProgress;

  // Handle CEFR band level-up when micro 20 gate is passed and progress reaches 100%.
  if (p.bandProgress >= 1.0) {
    const finalGate = computeMicroGateStatus(p, p.cefrBand, MICRO_LEVELS_PER_BAND - 1);
    const finalSkillGate = computeSkillGateStatus(p);
    if (finalGate.pass && finalSkillGate.pass) {
      const bands = ["A1", "A2", "B1", "B2"];
      const idx = bands.indexOf(p.cefrBand);
      if (idx < bands.length - 1) {
        p.cefrBand = bands[idx + 1];
        p.bandProgress = computeHybridBandProgress(p.wordExposure, p.progressPointsByBand, p.cefrBand);
        p.learningProgress = computeBandLearningProgress(p.wordExposure, p.cefrBand);
      }
    } else {
      p.bandProgress = 0.999;
    }
  }

  // Canonical level projection from current CEFR band + band progress.
  const prevOverallLevel = Number(p.overallLevel || 1);
  const { title, nextTitle, overallLevel, sublevel, pctWithinSublevel, microLevel, pctWithinMicro } = getLevelLabel(p.cefrBand, p.bandProgress);

  p.level = title;
  p.levelTitle = title;
  p.nextLevelTitle = nextTitle;
  p.microLevel = microLevel;
  p.microLevelProgress = pctWithinMicro;
  p.sublevel = sublevel;
  p.sublevelProgress = pctWithinSublevel;
  p.overallLevel = overallLevel;
  const leveledUp = overallLevel > prevOverallLevel;

  const recent = [...(p.recentAccuracies || []), accPct].slice(-20);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;

  let globalDifficulty = p.globalDifficulty || 1;
  if (recentAvg >= 82) globalDifficulty += 1;
  else if (recentAvg <= 55) globalDifficulty -= 1;
  p.globalDifficulty = clamp(Math.round(globalDifficulty), 1, 5);

  p.xp = (p.xp || 0) + Math.max(5, Math.round((normalized.points || 0) * (1 + (p.globalDifficulty - 1) * 0.12)));
  p.recentAccuracies = recent;
  p.mastery = {
    ...(p.mastery || {}),
    [lessonType]: {
      score: nextScore,
      attempts: (prior.attempts || 0) + 1,
      lastPlayed: new Date().toISOString(),
    },
  };

  const skillKey = primarySkillForModule(lessonType);
  const priorSkill = Number(p.skillMastery?.[skillKey] || 0);
  p.skillMastery = {
    ...(p.skillMastery || {}),
    [skillKey]: clamp(Math.round(priorSkill * 0.75 + accPct * 0.25), 0, 100),
  };
  p.lastLessonType = lessonType;
  p.updatedAt = new Date().toISOString();

  p.progressionEvents = appendProgressionEvent(p, {
    moduleType: lessonType,
    attemptedAt: normalized.attemptedAt,
    points: normalized.points,
    correct: normalized.correct,
    total: normalized.total,
    wordCount: normalized.wordResults.length,
    cefrBand: p.cefrBand,
    bandProgress: p.bandProgress,
    learningProgress: p.learningProgress || 0,
    progressPointsEarned: progressEarned,
    strengthPointsEarned: strengthEarned,
    progressPointsByBand: p.progressPointsByBand,
    strengthenedLevelKey: `${p.cefrBand}:${p.sublevel}`,
    levelTitle: p.levelTitle || p.level,
    nextLevelTitle: p.nextLevelTitle,
    microLevel: p.microLevel,
    microLevelProgress: p.microLevelProgress,
    sublevel: p.sublevel,
    sublevelProgress: p.sublevelProgress,
    overallLevel: p.overallLevel,
    leveledUp,
  });

  p.recommendedLessons = buildRecommendedLessons(p);
  return p;
}

export function recomputeProfileFromHistory(user = {}) {
  const migrated = migrateUser(user || {}) || user || {};
  const history = Array.isArray(migrated?.history) ? migrated.history : [];
  let profile = defaultLearningState();

  for (let i = 0; i < history.length; i += 1) {
    const h = history[i] || {};
    const lessonType = h.type || h.category || 'Flashcards';
    const total = Math.max(0, Number(h.total || 0));
    const correct = Math.max(0, Math.min(total, Number(h.correct || 0)));
    const explicit = Array.isArray(h?.meta?.wordResults) ? h.meta.wordResults : [];
    const fallback = explicit.length ? [] : Array.from({ length: Math.max(1, total || 1) }, (_, idx) => ({
      id: `hist:${lessonType}:${i}:${idx}`,
      cefr: profile?.cefrBand || 'A1',
      seen: 1,
      correct: idx < correct ? 1 : 0,
      bucket: idx < correct ? 'current' : 'review',
    }));

    profile = updateLearningProfile(profile, {
      lessonType,
      attemptedAt: h.date || new Date().toISOString(),
      points: Number(h.points || 0),
      correct,
      total,
      wordResults: explicit.length ? explicit : fallback,
    });
  }

  return profile;
}

export function buildRecommendedLessons(profile = {}) {
  const mastery = profile.mastery || {};

  const weak = LESSON_POOL
    .filter((l) => l !== "Placement Test")
    .map((l) => ({ lesson: l, score: typeof mastery[l]?.score === "number" ? mastery[l].score : 50 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((x) => x.lesson);

  const strong = LESSON_POOL
    .filter((l) => !weak.includes(l) && l !== "Placement Test")
    .map((l) => ({ lesson: l, score: typeof mastery[l]?.score === "number" ? mastery[l].score : 50 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.lesson);

  const mix = shuffled([
    ...weak.slice(0, 3),
    ...shuffled(strong).slice(0, 1),
    pickRandom(LESSON_POOL.filter((l) => l !== "Placement Test")),
  ].filter(Boolean));

  return [...new Set(mix)].slice(0, 4);
}
