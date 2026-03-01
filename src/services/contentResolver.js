// Spanish-app/src/services/contentResolver.js

import vocabData from '../content/cefr-vocab.json';

const ALL_VOCAB = vocabData.vocab || [];
const BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
  return { seen, correct, acc };
}

function uniqueById(words = []) {
  const map = new Map();
  for (const w of words) map.set(w.id || w.es, w);
  return [...map.values()];
}

/**
 * Adaptive resolver for module word pools.
 * Mix: 70% current band, 20% review, 10% stretch.
 */
export function getWordsForFlashcards(profile, count = 10) {
  const currentBand = profile?.cefrBand || 'A1';
  const stretchBand = nextBand(currentBand);

  const currentPool = ALL_VOCAB
    .filter((w) => w.cefr === currentBand)
    .filter((w) => {
      const { seen, acc } = exposureStats(profile, w.id || w.es);
      // prioritize unseen or not-yet-mastered words
      return seen < 3 || acc < 0.7;
    });

  const reviewPool = ALL_VOCAB
    .filter((w) => {
      const { seen } = exposureStats(profile, w.id || w.es);
      return seen > 0;
    })
    .filter((w) => w.cefr === currentBand);

  const stretchPool = ALL_VOCAB
    .filter((w) => stretchBand && w.cefr === stretchBand)
    .filter((w) => exposureStats(profile, w.id || w.es).seen === 0);

  const currentTarget = Math.max(1, Math.round(count * 0.7));
  const reviewTarget = Math.max(0, Math.round(count * 0.2));
  const stretchTarget = Math.max(0, count - currentTarget - reviewTarget);

  let picked = [
    ...shuffle(currentPool).slice(0, currentTarget),
    ...shuffle(reviewPool).slice(0, reviewTarget),
    ...shuffle(stretchPool).slice(0, stretchTarget),
  ];

  picked = uniqueById(picked);

  // Fill remaining slots from current band as fallback.
  if (picked.length < count) {
    const fallback = shuffle(ALL_VOCAB.filter((w) => w.cefr === currentBand));
    for (const w of fallback) {
      if (picked.length >= count) break;
      if (!picked.find((p) => (p.id || p.es) === (w.id || w.es))) picked.push(w);
    }
  }

  return shuffle(picked).slice(0, count);
}
