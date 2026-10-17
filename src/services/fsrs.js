// FSRS-4.5 based word review scheduler for chadlingo.
//
// Replaces the legacy (+1/-1 stability counter, fixed 1/3/7/14-day buckets)
// with the open-source FSRS (Free Spaced Repetition Scheduler) memory model:
// each word carries a difficulty (1-10) and a stability in days, and the next
// review is scheduled when predicted retrievability decays to 90%.
//
// FSRS-4.5 default weights (17 params) and formulas per the FSRS spec:
//   R(t, S) = (1 + FACTOR * t / S) ^ DECAY          (forgetting curve)
//   D0(G)   = w4 - (G - 3) * w5                     (initial difficulty)
//   S0(G)   = w[G - 1]                             (initial stability, days)
//   next interval for 90% retention ~= S days
//
// Legacy entries (no `difficulty` field) are warm-started once from their
// old counter + accuracy, then follow standard FSRS updates.

export const FSRS_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
  1.616, 0.1544, 1.0824, 1.9763, 0.0904, 0.4827, 1.7721, 0.1937, 2.8718,
];

const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ~= 0.2346

export const FSRS_DESIRED_RETENTION = 0.9;
export const FSRS_MAX_INTERVAL_DAYS = 180;
export const FSRS_MIN_INTERVAL_HOURS = 4;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Predicted probability of recalling a word `elapsedDays` after last review. */
export function fsrsRetrievability(elapsedDays, stability) {
  const s = Math.max(0.01, Number(stability) || 0.01);
  const t = Math.max(0, Number(elapsedDays) || 0);
  return Math.pow(1 + (FACTOR * t) / s, DECAY);
}

function initDifficulty(grade) {
  return clamp(FSRS_W[4] - (grade - 3) * FSRS_W[5], 1, 10);
}

function initStability(grade) {
  return Math.max(0.01, FSRS_W[clamp(grade, 1, 4) - 1]);
}

function nextDifficulty(difficulty, grade) {
  const deltaD = -FSRS_W[6] * (grade - 3);
  const nextD = difficulty + (deltaD * (10 - difficulty)) / 9;
  return clamp(FSRS_W[7] * initDifficulty(4) + (1 - FSRS_W[7]) * nextD, 1, 10);
}

function nextRecallStability(difficulty, stability, retrievability, grade) {
  const hardPenalty = grade === 2 ? FSRS_W[15] : 1;
  const easyBonus = grade === 4 ? FSRS_W[16] : 1;
  const r = clamp(retrievability, 0.01, 1);
  const s = Math.max(0.01, stability);
  return Math.max(
    0.01,
    s *
      (1 +
        Math.exp(FSRS_W[8]) *
          (11 - difficulty) *
          Math.pow(s, -FSRS_W[9]) *
          (Math.exp((1 - r) * FSRS_W[10]) - 1) *
          hardPenalty *
          easyBonus)
  );
}

function nextForgetStability(difficulty, stability, retrievability) {
  const r = clamp(retrievability, 0.01, 1);
  const s = Math.max(0.01, stability);
  return Math.max(
    0.01,
    FSRS_W[11] *
      Math.pow(difficulty, -FSRS_W[12]) *
      (Math.pow(s + 1, FSRS_W[13]) - 1) *
      Math.exp((1 - r) * FSRS_W[14])
  );
}

/** Days until retrievability decays to the desired retention. */
export function fsrsIntervalDays(stability, desiredRetention = FSRS_DESIRED_RETENTION) {
  const s = Math.max(0.01, Number(stability) || 0.01);
  const interval = (s / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
  return clamp(interval, FSRS_MIN_INTERVAL_HOURS / 24, FSRS_MAX_INTERVAL_DAYS);
}

/**
 * Map an app word result to an FSRS grade (1=Again, 2=Hard, 3=Good).
 * We don't emit Easy (4): nothing in the result stream signals it reliably.
 */
export function gradeFromWordResult(wr = {}) {
  const isCorrect = Number(wr.correct || 0) > 0;
  if (!isCorrect) return 1;
  if (wr.hintUsed) return 2;
  return 3;
}

/**
 * Warm-start FSRS state for words tracked by the legacy scheduler.
 * Uses the old counter (higher = historically stronger) and lifetime
 * accuracy so long-known words keep long intervals instead of resetting.
 */
export function seedFsrsState({ seen = 0, correct = 0, legacyStability = 0 } = {}) {
  const s = Math.max(0, Number(seen) || 0);
  const c = Math.max(0, Number(correct) || 0);
  const accuracy = s > 0 ? clamp(c / s, 0, 1) : 0.5;
  const legacy = Math.max(0, Number(legacyStability) || 0);
  return {
    difficulty: clamp(6 - 3 * accuracy, 1.5, 9),
    stability: clamp((1 + legacy) * (0.6 + accuracy), 1, 30),
  };
}

/**
 * Apply one FSRS review. Returns { difficulty, stability, nextReviewAt, intervalDays }.
 * Pass difficulty/stability as null for brand-new words.
 */
export function fsrsReview({ difficulty, stability, lastSeenMs, grade, nowMs = Date.now() } = {}) {
  const g = clamp(Math.round(Number(grade) || 3), 1, 4);
  let d;
  let s;
  if (difficulty == null || stability == null) {
    d = initDifficulty(g);
    s = initStability(g);
  } else {
    const elapsedDays = lastSeenMs && Number.isFinite(lastSeenMs) ? Math.max(0, (nowMs - lastSeenMs) / 86400000) : 0;
    const r = fsrsRetrievability(elapsedDays, stability);
    d = nextDifficulty(difficulty, g);
    s = g === 1 ? nextForgetStability(difficulty, stability, r) : nextRecallStability(difficulty, stability, r, g);
  }
  const intervalDays = fsrsIntervalDays(s);
  return {
    difficulty: d,
    stability: s,
    intervalDays,
    nextReviewAt: new Date(nowMs + intervalDays * 86400000).toISOString(),
  };
}
