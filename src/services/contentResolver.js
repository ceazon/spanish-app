// Spanish-app/src/services/contentResolver.js

import vocabData from '../content/cefr-vocab.json';

const ALL_VOCAB = vocabData.vocab;

/**
 * Intelligent content resolver for the Flashcard module.
 * Picks words based on the user's level.
 * 
 * @param {object} profile - The user's learning profile (Schema v2/v3).
 * @param {number} count - Desired number of words.
 * @returns {array} Array of selected words.
 */
export function getWordsForFlashcards(profile, count = 10) {
  // Determine current band. Default to A1 for new users.
  const currentBand = profile?.cefrBand || "A1";
  
  // Filter vocab by band
  const pool = ALL_VOCAB.filter(w => w.cefr === currentBand);
  
  // For now, we do simple random selection from the band.
  // We can add "spaced repetition" logic here in the next incremental step.
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  
  return shuffled.slice(0, count);
}
