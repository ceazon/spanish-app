// Spanish-app/src/services/progression.js

import {
  CEFR_LEVELS,
  LEVEL_TITLES,
  TOTAL_LEVELS_PER_BAND,
  INITIAL_USER_PROFILE_V3,
} from '../config/cefr';

// This is a lightweight in-memory cache for the vocab counts.
// In a larger app, this would be part of a more robust data layer.
import vocabData from '../content/cefr-vocab.json';
const vocabCounts = vocabData.counts;

/**
 * Ensures the user profile is on the latest schema.
 * As per the plan, if the schema is old, it wipes the profile clean.
 * @param {object} profile - The user's current learning profile.
 * @returns {object} A valid v3 profile.
 */
export function migrateProfile(profile) {
  if (profile && profile.schemaVersion === INITIAL_USER_PROFILE_V3.schemaVersion) {
    return profile;
  }
  // Wipe and reset for any other case (missing, or old version)
  return { ...INITIAL_USER_PROFILE_V3 };
}

/**
 * Calculates the user's "Band Strength" (a 0-10 score).
 * This formula rewards both coverage (seeing many unique words) and accuracy.
 * @param {object} wordExposure - The user's word exposure map.
 * @param {string} cefrBand - The user's current CEFR band (e.g., "A1").
 * @returns {number} The calculated band strength, rounded to one decimal.
 */
export function calculateBandStrength(wordExposure, cefrBand) {
  const wordsInBand = Object.values(wordExposure).filter(w => w.cefr === cefrBand);
  const totalWordsInBand = vocabCounts[cefrBand] || 1; // Avoid division by zero
  
  if (wordsInBand.length === 0) return 0;

  const seenCount = wordsInBand.length;
  const correct = wordsInBand.reduce((acc, w) => acc + (w.correct || 0), 0);
  const attempts = wordsInBand.reduce((acc, w) => acc + (w.seen || 0), 0);

  const coverage = seenCount / totalWordsInBand;
  const accuracy = attempts > 0 ? correct / attempts : 0;
  
  const strength = Math.max(0, Math.min(10, coverage * accuracy * 10));
  return Math.round(strength * 10) / 10;
}

/**
 * Calculates the user's progress within their current CEFR band.
 * Progress is based only on *coverage* (unique words seen), not accuracy.
 * @param {object} wordExposure - The user's word exposure map.
 * @param {string} cefrBand - The user's current CEFR band.
 * @returns {number} Progress as a float between 0.0 and 1.0.
 */
export function calculateBandProgress(wordExposure, cefrBand) {
  const wordsInBand = Object.values(wordExposure).filter(w => w.cefr === cefrBand);
  const totalWordsInBand = vocabCounts[cefrBand] || 1;
  const progress = Math.max(0, Math.min(1, wordsInBand.length / totalWordsInBand));
  return progress;
}

/**
 * Updates a user's profile after a learning session.
 * @param {object} profile - The user's current v3 profile.
 * @param {array} sessionResults - Array of word result objects, e.g., [{ id, es, en, cefr, correct }]
 * @returns {object} The updated user profile.
 */
export function updateProfileAfterSession(profile, sessionResults) {
  const updatedProfile = { ...profile, wordExposure: { ...profile.wordExposure } };

  let newWordsIntroduced = 0;

  sessionResults.forEach(result => {
    const { id, cefr } = result;
    const prior = updatedProfile.wordExposure[id] || { seen: 0, correct: 0 };
    
    if (prior.seen === 0) {
      newWordsIntroduced++;
    }

    updatedProfile.wordExposure[id] = {
      seen: (prior.seen || 0) + 1,
      correct: (prior.correct || 0) + (result.correct ? 1 : 0),
      lastSeen: new Date().toISOString(),
      cefr: cefr // Store the band on the word for easier filtering
    };
  });

  // Update aggregate stats
  updatedProfile.totalAttempts += sessionResults.length;
  updatedProfile.totalCorrect += sessionResults.filter(r => r.correct).length;
  updatedProfile.totalWordsIntroduced += newWordsIntroduced;
  updatedProfile.lastSessionDate = new Date().toISOString().split('T')[0];

  // Recalculate progression
  const { cefrBand } = updatedProfile;
  updatedProfile.bandProgress = calculateBandProgress(updatedProfile.wordExposure, cefrBand);
  updatedProfile.bandStrength = calculateBandStrength(updatedProfile.wordExposure, cefrBand);
  
  const newSublevel = Math.floor(updatedProfile.bandProgress * TOTAL_LEVELS_PER_BAND);
  updatedProfile.sublevel = Math.max(0, Math.min(TOTAL_LEVELS_PER_BAND - 1, newSublevel));
  
  // TODO: Handle band completion and transition to the next band (e.g., A1 -> A2)
  if (updatedProfile.bandProgress >= 1.0) {
    // This logic will be part of the celebration/gamification phase (Phase 3)
    console.log(`User has completed band ${cefrBand}!`);
  }

  return updatedProfile;
}

/**
 * Determines a user's starting band and sublevel from a placement test score.
 * @param {number} correct - Number of correct answers.
 * @param {number} total - Total questions in the test.
 * @returns {{ cefrBand: string, sublevel: number }}
 */
export function getPlacementFromScore(correct, total) {
  const percentage = total > 0 ? correct / total : 0;
  
  if (percentage >= 0.8) {
    // Starts user at the beginning of A2
    return { cefrBand: 'A2', sublevel: 0 };
  } else if (percentage >= 0.4) {
    // Starts user halfway through A1
    return { cefrBand: 'A1', sublevel: 5 };
  } else {
    // Starts user at the beginning of A1
    return { cefrBand: 'A1', sublevel: 0 };
  }
}
