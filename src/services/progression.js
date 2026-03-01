// Spanish-app/src/services/progression.js

import { getLevelLabel } from '../config/cefr.js';
import vocabData from '../content/cefr-vocab.json' with { type: 'json' };

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

// Upgrading to v3 for the CEFR progression system
export const PROFILE_SCHEMA_VERSION = 3;
const CEFR_COUNTS = vocabData?.counts || { A1: 1, A2: 1, B1: 1, B2: 1 };

function normalizeExposureEntry(entry = {}) {
  const seen = Number(entry.seen || 0);
  const correct = Number(entry.correct || 0);
  return {
    seen,
    correct,
    cefr: entry.cefr || "A1",
    lastSeen: entry.lastSeen || null,
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

function applyWordResults(profile, wordResults = []) {
  const nextExposure = { ...(profile.wordExposure || {}) };
  for (const wr of wordResults) {
    const id = wr?.id;
    if (!id) continue;
    const prior = normalizeExposureEntry(nextExposure[id]);
    nextExposure[id] = {
      ...prior,
      cefr: wr.cefr || prior.cefr || profile.cefrBand || "A1",
      seen: prior.seen + Number(wr.seen || 1),
      correct: prior.correct + Number(wr.correct || 0),
      lastSeen: new Date().toISOString(),
    };
  }
  return nextExposure;
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
];

export function defaultLearningState() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    xp: 0,
    cefrBand: "A1",
    bandProgress: 0.0, // mastery progress 0.0..1.0
    learningProgress: 0.0, // exposure progress 0.0..1.0
    level: "Newcomer",
    levelTitle: "Newcomer",
    nextLevelTitle: "Beginner",
    sublevel: 0,
    sublevelProgress: 0,
    overallLevel: 1,   // 1 to 40
    globalDifficulty: 1,
    recentAccuracies: [],
    mastery: {},
    wordExposure: {}, // Tracking per-word mastery
    progressionEvents: [], // rolling ledger for debugging and analytics
    recommendedLessons: ["Flashcards", "Word Match", "Fill in the Blank"],
    lastLessonType: null,
    updatedAt: new Date().toISOString(),
  };
}

export function migrateUser(user) {
  if (!user) return user;
  const p = user.profile || {};

  // If already v3, just return
  if (p.schemaVersion === 3) return user;

  // v2 -> v3 migration
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
  learning.learningProgress = computeBandLearningProgress(learning.wordExposure || {}, learning.cefrBand);
  const { title, nextTitle, overallLevel, sublevel, pctWithinSublevel } = getLevelLabel(learning.cefrBand, learning.bandProgress);
  learning.level = title;
  learning.levelTitle = title;
  learning.nextLevelTitle = nextTitle;
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
  const p = profile.schemaVersion === 3 ? { ...profile } : migrateUser({ profile }).profile;
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

  // Progress is based on mastered words, not just raw correct answers.
  p.bandProgress = computeBandProgressFromMastery(p.wordExposure, p.cefrBand);
  // Learning progress is exposure-based so users see momentum quickly.
  p.learningProgress = computeBandLearningProgress(p.wordExposure, p.cefrBand);

  // Handle CEFR band level-up when mastered progress reaches 100%.
  if (p.bandProgress >= 1.0) {
    const bands = ["A1", "A2", "B1", "B2"];
    const idx = bands.indexOf(p.cefrBand);
    if (idx < bands.length - 1) {
      p.cefrBand = bands[idx + 1];
      p.bandProgress = computeBandProgressFromMastery(p.wordExposure, p.cefrBand);
      p.learningProgress = computeBandLearningProgress(p.wordExposure, p.cefrBand);
    }
  }

  // Update user-friendly label/title every 10% sublevel.
  const prevOverallLevel = p.overallLevel || 1;
  const { title, nextTitle, overallLevel, sublevel, pctWithinSublevel } = getLevelLabel(p.cefrBand, p.bandProgress);
  p.level = title;
  p.levelTitle = title;
  p.nextLevelTitle = nextTitle;
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
    levelTitle: p.levelTitle || p.level,
    nextLevelTitle: p.nextLevelTitle,
    sublevel: p.sublevel,
    sublevelProgress: p.sublevelProgress,
    overallLevel: p.overallLevel,
    leveledUp,
  });

  p.recommendedLessons = buildRecommendedLessons(p);
  return p;
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
