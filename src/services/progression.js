// Spanish-app/src/services/progression.js

import {
  CEFR_LEVELS,
  LEVEL_TITLES,
  TOTAL_LEVELS_PER_BAND,
  INITIAL_USER_PROFILE_V3,
} from '../config/cefr';
import vocabData from '../content/cefr-vocab.json';
const vocabCounts = vocabData.counts;

export function migrateProfile(profile) {
  if (profile && profile.schemaVersion === INITIAL_USER_PROFILE_V3.schemaVersion) {
    return profile;
  }
  return { ...INITIAL_USER_PROFILE_V3 };
}

export function calculateBandStrength(wordExposure, cefrBand) {
  const wordsInBand = Object.values(wordExposure).filter(w => w.cefr === cefrBand);
  const totalWordsInBand = vocabCounts[cefrBand] || 1;
  if (wordsInBand.length === 0) return 0;
  const seenCount = wordsInBand.length;
  const correct = wordsInBand.reduce((acc, w) => acc + (w.correct || 0), 0);
  const attempts = wordsInBand.reduce((acc, w) => acc + (w.seen || 0), 0);
  const coverage = seenCount / totalWordsInBand;
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const strength = Math.max(0, Math.min(10, coverage * accuracy * 10));
  return Math.round(strength * 10) / 10;
}

export function calculateBandProgress(wordExposure, cefrBand) {
  const wordsInBand = Object.values(wordExposure).filter(w => w.cefr === cefrBand);
  const totalWordsInBand = vocabCounts[cefrBand] || 1;
  const progress = Math.max(0, Math.min(1, wordsInBand.length / totalWordsInBand));
  return progress;
}

export function updateProfileAfterSession(profile, sessionResults) {
  const updatedProfile = { ...profile, wordExposure: { ...profile.wordExposure } };
  let newWordsIntroduced = 0;
  sessionResults.forEach(result => {
    const { id, cefr } = result;
    const prior = updatedProfile.wordExposure[id] || { seen: 0, correct: 0 };
    if (prior.seen === 0) newWordsIntroduced++;
    updatedProfile.wordExposure[id] = {
      seen: (prior.seen || 0) + 1,
      correct: (prior.correct || 0) + (result.correct ? 1 : 0),
      lastSeen: new Date().toISOString(),
      cefr: cefr
    };
  });
  updatedProfile.totalAttempts += sessionResults.length;
  updatedProfile.totalCorrect += sessionResults.filter(r => r.correct).length;
  updatedProfile.totalWordsIntroduced += newWordsIntroduced;
  updatedProfile.lastSessionDate = new Date().toISOString().split('T')[0];
  const { cefrBand } = updatedProfile;
  updatedProfile.bandProgress = calculateBandProgress(updatedProfile.wordExposure, cefrBand);
  updatedProfile.bandStrength = calculateBandStrength(updatedProfile.wordExposure, cefrBand);
  const newSublevel = Math.floor(updatedProfile.bandProgress * TOTAL_LEVELS_PER_BAND);
  updatedProfile.sublevel = Math.max(0, Math.min(TOTAL_LEVELS_PER_BAND - 1, newSublevel));
  return updatedProfile;
}

export function getPlacementFromScore(correct, total) {
  const percentage = total > 0 ? correct / total : 0;
  if (percentage >= 0.8) return { cefrBand: 'A2', sublevel: 0 };
  if (percentage >= 0.4) return { cefrBand: 'A1', sublevel: 5 };
  return { cefrBand: 'A1', sublevel: 0 };
}
