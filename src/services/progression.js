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

export const PROFILE_SCHEMA_VERSION = 2;

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
    level: "starter",
    globalDifficulty: 1, // 1-5
    recentAccuracies: [],
    mastery: {}, // by lesson type: { score(0-100), attempts, lastPlayed }
    recommendedLessons: ["Flashcards", "Word Match", "Fill in the Blank"],
    lastLessonType: null,
    updatedAt: new Date().toISOString(),
  };
}

export function migrateUser(user) {
  if (!user) return user;
  const profile = user.profile || {};

  // v0/v1 -> v2 unified learning profile
  const learning = {
    ...defaultLearningState(),
    ...profile,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    level: profile.level || "starter",
    recommendedLessons: Array.isArray(profile.recommendedLessons) && profile.recommendedLessons.length
      ? profile.recommendedLessons
      : defaultLearningState().recommendedLessons,
    mastery: profile.mastery || {},
    recentAccuracies: Array.isArray(profile.recentAccuracies) ? profile.recentAccuracies.slice(-20) : [],
    globalDifficulty: clamp(Number(profile.globalDifficulty || 1), 1, 5),
    updatedAt: new Date().toISOString(),
  };

  return {
    ...user,
    profile: learning,
  };
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
  const level = pct >= 0.8 ? "intermediate" : pct >= 0.5 ? "beginner" : "starter";
  const recommendedLessons = level === "intermediate"
    ? ["Scenario Builder", "Chat Partner", "Speed Round"]
    : level === "beginner"
      ? ["Learn Verbs", "Transcription", "Sentence Scramble"]
      : ["Flashcards", "Word Match", "Fill in the Blank"];
  return { level, recommendedLessons };
}

export function getAdaptiveDifficulty(profile = {}, lessonType) {
  const p = { ...defaultLearningState(), ...(profile || {}) };
  const base = clamp(Number(p.globalDifficulty || 1), 1, 5);
  const mastery = p.mastery?.[lessonType]?.score;
  if (typeof mastery !== "number") return base;
  if (mastery >= 85) return clamp(base + 1, 1, 5);
  if (mastery <= 45) return clamp(base - 1, 1, 5);
  return base;
}

export function updateLearningProfile(profile = {}, result = {}) {
  const p = { ...defaultLearningState(), ...(profile || {}) };
  const lessonType = result.lessonType || result.type || "Unknown";
  const accuracy = result.total > 0 ? (result.correct || 0) / result.total : 0;
  const accPct = Math.round(accuracy * 100);

  const prior = p.mastery?.[lessonType] || { score: 50, attempts: 0 };
  const nextScore = clamp(Math.round(prior.score * 0.75 + accPct * 0.25), 0, 100);

  const recent = [...(p.recentAccuracies || []), accPct].slice(-20);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;

  let globalDifficulty = p.globalDifficulty || 1;
  if (recentAvg >= 82) globalDifficulty += 1;
  else if (recentAvg <= 55) globalDifficulty -= 1;
  globalDifficulty = clamp(Math.round(globalDifficulty), 1, 5);

  const xpGain = Math.max(5, Math.round((result.points || 0) * (1 + (globalDifficulty - 1) * 0.12)));

  const updated = {
    ...p,
    xp: (p.xp || 0) + xpGain,
    recentAccuracies: recent,
    globalDifficulty,
    mastery: {
      ...(p.mastery || {}),
      [lessonType]: {
        score: nextScore,
        attempts: (prior.attempts || 0) + 1,
        lastPlayed: new Date().toISOString(),
      },
    },
    lastLessonType: lessonType,
    updatedAt: new Date().toISOString(),
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };

  updated.recommendedLessons = buildRecommendedLessons(updated);
  return updated;
}

export function buildRecommendedLessons(profile = {}) {
  const p = { ...defaultLearningState(), ...(profile || {}) };
  const mastery = p.mastery || {};

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
