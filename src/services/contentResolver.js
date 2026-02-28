// Spanish-app/src/services/contentResolver.js

import { CONTENT_BUCKET_SHARES, MAX_NEW_WORDS_PER_SESSION, LEVEL_TITLES } from '../config/cefr';
import vocabData from '../content/cefr-vocab.json';
// Assume an AI service exists, e.g., import { gemini_flash } from './ai';

const ALL_VOCAB = vocabData.vocab;

export function getWordsForSession(profile, count) {
  const { wordExposure, cefrBand } = profile;
  const seenWords = new Set(Object.keys(wordExposure));
  const nextBand = getNextBand(cefrBand);
  const buckets = { current: [], review: [], stretch: [], weak: [] };

  for (const word of ALL_VOCAB) {
    if (!seenWords.has(word.id)) {
      if (word.cefr === cefrBand) buckets.current.push(word);
      else if (word.cefr === nextBand) buckets.stretch.push({ ...word, isStretch: true });
    } else {
      const exposure = wordExposure[word.id];
      const accuracy = exposure.seen > 0 ? exposure.correct / exposure.seen : 0;
      if (accuracy < 0.4) buckets.weak.push(word);
      else if (accuracy >= 0.8) buckets.review.push(word);
      else if (word.cefr === cefrBand) buckets.current.push(word);
    }
  }
  
  buckets.review.sort((a, b) => new Date(wordExposure[a.id]?.lastSeen || 0) - new Date(wordExposure[b.id]?.lastSeen || 0));

  let sessionWords = [];
  const counts = {
    weak: Math.floor(count * CONTENT_BUCKET_SHARES.WEAK),
    review: Math.floor(count * CONTENT_BUCKET_SHARES.REVIEW),
    stretch: Math.floor(count * CONTENT_BUCKET_SHARES.STRETCH),
  };
  
  sessionWords.push(...buckets.weak.splice(0, counts.weak));
  sessionWords.push(...buckets.review.splice(0, counts.review));
  sessionWords.push(...buckets.stretch.splice(0, Math.min(counts.stretch, MAX_NEW_WORDS_PER_SESSION)));
  
  const currentCount = count - sessionWords.length;
  sessionWords.push(...buckets.current.splice(0, currentCount));

  const allRemaining = [...buckets.current, ...buckets.review, ...buckets.stretch, ...buckets.weak];
  let i = 0;
  while (sessionWords.length < count && i < allRemaining.length) {
    if (!sessionWords.find(w => w.id === allRemaining[i].id)) {
      sessionWords.push(allRemaining[i]);
    }
    i++;
  }

  return shuffleArray(sessionWords).slice(0, count);
}

export async function getSentencesForSession(profile, wordPool, sentenceCount) {
  // Mock AI call for now to avoid real API dependency in this step
  console.log("AI Call Skipped: Generating mock sentences.");
  return Promise.resolve([
    { es: "El gato está en la casa.", en: "The cat is in the house." },
    { es: "Yo bebo café por la mañana.", en: "I drink coffee in the morning." }
  ]);
}

function getNextBand(band) {
  const bands = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const index = bands.indexOf(band);
  return index !== -1 && index < bands.length - 1 ? bands[index + 1] : null;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
