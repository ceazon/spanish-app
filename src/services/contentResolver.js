// Spanish-app/src/services/contentResolver.js

import vocabData from '../content/cefr-vocab.json';

const ALL_VOCAB = vocabData.vocab || [];
const BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Tunable progression knobs (safe defaults)
const MASTERY_MIN_SEEN = 3;
const MASTERY_MIN_ACC = 0.7;
const SUBLEVEL_GATE_RATIO = 0.8; // 80% mastered in current sublevel to unlock stretch

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffle(arr = []) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nextBand(band = 'A1') {
  const idx = BAND_ORDER.indexOf(band);
  return idx >= 0 && idx < BAND_ORDER.length - 1 ? BAND_ORDER[idx + 1] : null;
}

function exposureStats(profile, wordId) {
  const e = profile?.wordExposure?.[wordId] || { seen: 0, correct: 0 };
  const seen = Number(e.seen || 0);
  const correct = Number(e.correct || 0);
  const acc = seen > 0 ? correct / seen : 0;
  return { seen, correct, acc, mastered: seen >= MASTERY_MIN_SEEN && acc >= MASTERY_MIN_ACC };
}

function uniqueById(words = []) {
  const map = new Map();
  for (const w of words) map.set(w.id || w.es, w);
  return [...map.values()];
}

function wordsInBand(band = 'A1') {
  return ALL_VOCAB.filter((w) => w.cefr === band);
}

/**
 * Derive a 0-9 sublevel bucket for a word inside its CEFR band.
 * This avoids hardcoding buckets in content during incremental rollout.
 */
function deriveSublevel(word, bandWords) {
  const list = bandWords || wordsInBand(word.cefr);
  const idx = Math.max(0, list.findIndex((w) => (w.id || w.es) === (word.id || word.es)));
  const denom = Math.max(1, list.length);
  return clamp(Math.floor((idx / denom) * 10), 0, 9);
}

function splitPoolsByProgress(profile, band = 'A1') {
  const bWords = wordsInBand(band);
  const currentSub = clamp(Number(profile?.sublevel || 0), 0, 9);

  const current = [];
  const review = [];
  const stretch = [];

  for (const w of bWords) {
    const stats = exposureStats(profile, w.id || w.es);
    const sub = deriveSublevel(w, bWords);

    if (sub < currentSub) {
      // Earlier levels become review material
      review.push({ ...w, _sub: sub });
      continue;
    }

    if (sub === currentSub) {
      // Current bucket focus: unseen or not mastered first
      current.push({ ...w, _sub: sub, _priority: stats.mastered ? 1 : 0 });
      if (stats.mastered) review.push({ ...w, _sub: sub });
      continue;
    }

    // Future buckets in same CEFR band are stretch candidates
    stretch.push({ ...w, _sub: sub });
  }

  // Sort current so not-mastered words appear first
  current.sort((a, b) => (a._priority || 0) - (b._priority || 0));

  return { current, review, stretch, currentSub, bWords };
}

function currentSublevelMasteryRatio(profile, band = 'A1', currentSub = 0, bandWords = []) {
  const inSub = (bandWords || wordsInBand(band)).filter((w) => deriveSublevel(w, bandWords) === currentSub);
  if (!inSub.length) return 0;
  const mastered = inSub.filter((w) => exposureStats(profile, w.id || w.es).mastered).length;
  return mastered / inSub.length;
}

/**
 * Scalable selector used by all modules.
 * Returns CEFR-appropriate words with progression gating.
 */
export function selectWordsForModule({ profile, moduleType = 'Flashcards', count = 10 } = {}) {
  const safeCount = Math.max(4, Number(count || 10));
  const currentBand = profile?.cefrBand || 'A1';
  const next = nextBand(currentBand);

  const { current, review, stretch, currentSub, bWords } = splitPoolsByProgress(profile, currentBand);
  const masteryRatio = currentSublevelMasteryRatio(profile, currentBand, currentSub, bWords);
  const allowStretch = masteryRatio >= SUBLEVEL_GATE_RATIO;

  // Base mix
  let currentTarget = Math.round(safeCount * 0.7);
  let reviewTarget = Math.round(safeCount * 0.2);
  let stretchTarget = safeCount - currentTarget - reviewTarget;

  if (!allowStretch) {
    // Keep learner focused on basics until mastered
    currentTarget = Math.round(safeCount * 0.8);
    reviewTarget = safeCount - currentTarget;
    stretchTarget = 0;
  }

  let picked = [
    ...shuffle(current).slice(0, currentTarget),
    ...shuffle(review).slice(0, reviewTarget),
  ];

  if (stretchTarget > 0) {
    picked.push(...shuffle(stretch).slice(0, stretchTarget));

    // If same-band stretch is thin, cautiously pull from next CEFR band unseen words
    if (picked.length < safeCount && next) {
      const nextBandWords = wordsInBand(next).filter((w) => exposureStats(profile, w.id || w.es).seen === 0);
      picked.push(...shuffle(nextBandWords).slice(0, safeCount - picked.length));
    }
  }

  picked = uniqueById(picked);

  // Last fallback: fill from current band only
  if (picked.length < safeCount) {
    const fallback = shuffle(wordsInBand(currentBand));
    for (const w of fallback) {
      if (picked.length >= safeCount) break;
      if (!picked.find((p) => (p.id || p.es) === (w.id || w.es))) picked.push(w);
    }
  }

  return shuffle(picked).slice(0, safeCount);
}

// Backward-compatible wrapper used by existing module code
export function getWordsForFlashcards(profile, count = 10) {
  return selectWordsForModule({ profile, moduleType: 'Flashcards', count });
}
