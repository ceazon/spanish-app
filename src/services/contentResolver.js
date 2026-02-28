// Spanish-app/src/services/contentResolver.js

import { CONTENT_BUCKET_SHARES, MAX_NEW_WORDS_PER_SESSION } from '../config/cefr';
import vocabData from '../content/cefr-vocab.json';
import { gemini_flash } from './ai'; // Assuming an AI service module

const ALL_VOCAB = vocabData.vocab;

/**
 * The main content resolver for the application.
 * Selects an intelligent mix of words for a user's session based on their profile.
 *
 * @param {object} profile - The user's v3 learning profile.
 * @param {number} count - The total number of words desired for the session.
 * @returns {array} An array of word objects for the session.
 */
export function getWordsForSession(profile, count) {
  const { wordExposure, cefrBand } = profile;

  const seenWords = new Set(Object.keys(wordExposure));
  const nextBand = getNextBand(cefrBand);

  // 1. Categorize all vocab into buckets based on user's history
  const buckets = {
    current: [],
    review: [],
    stretch: [],
    weak: [],
  };

  for (const word of ALL_VOCAB) {
    if (!seenWords.has(word.id)) {
      // Unseen words
      if (word.cefr === cefrBand) {
        buckets.current.push(word); // Unseen in current band goes to 'current'
      } else if (word.cefr === nextBand) {
        buckets.stretch.push(word);
      }
    } else {
      // Seen words
      const exposure = wordExposure[word.id];
      const accuracy = exposure.seen > 0 ? exposure.correct / exposure.seen : 0;

      if (accuracy < 0.4) {
        buckets.weak.push(word);
      } else if (accuracy >= 0.8) {
        buckets.review.push(word);
      } else {
        // Words seen but not mastered, in their current band
        if (word.cefr === cefrBand) {
          buckets.current.push(word);
        }
      }
    }
  }
  
  // Sort review words by least recently seen
  buckets.review.sort((a, b) => {
    const lastSeenA = new Date(wordExposure[a.id]?.lastSeen || 0);
    const lastSeenB = new Date(wordExposure[b.id]?.lastSeen || 0);
    return lastSeenA - lastSeenB;
  });

  // 2. Build the session list according to bucket shares
  let sessionWords = [];
  let stretchCount = 0;

  const counts = {
    current: Math.floor(count * CONTENT_BUCKET_SHARES.CURRENT),
    review: Math.floor(count * CONTENT_BUCKET_SHARES.REVIEW),
    stretch: Math.floor(count * CONTENT_BUCKET_SHARES.STRETCH),
    weak: Math.floor(count * CONTENT_BUCKET_SHARES.WEAK),
  };
  
  // Add guaranteed 'weak' words first
  sessionWords.push(...buckets.weak.splice(0, counts.weak));
  
  // Add 'review' words
  sessionWords.push(...buckets.review.splice(0, counts.review));
  
  // Add 'stretch' words, respecting the max new words limit
  const stretchLimit = Math.min(counts.stretch, MAX_NEW_WORDS_PER_SESSION);
  sessionWords.push(...buckets.stretch.splice(0, stretchLimit));
  
  // Add 'current' words
  sessionWords.push(...buckets.current.splice(0, counts.current));

  // 3. Fill any remaining spots
  // If we don't have enough words, fill from the largest available buckets.
  const allRemaining = [...buckets.current, ...buckets.review, ...buckets.stretch, ...buckets.weak];
  let i = 0;
  while (sessionWords.length < count && i < allRemaining.length) {
    const word = allRemaining[i];
    if (!sessionWords.find(w => w.id === word.id)) {
      sessionWords.push(word);
    }
    i++;
  }

  return shuffleArray(sessionWords).slice(0, count);
}

/**
 * Generates dynamic, level-appropriate sentences for a session.
 *
 * @param {object} profile - The user's v3 learning profile.
 * @param {array} wordPool - A list of words to potentially include in sentences.
 * @param {number} sentenceCount - The number of sentences to generate.
 * @returns {Promise<array>} A promise that resolves to an array of sentence objects.
 */
export async function getSentencesForSession(profile, wordPool, sentenceCount) {
  const { cefrBand } = profile;
  const levelTitle = LEVEL_TITLES[cefrBand][profile.sublevel];
  const wordList = wordPool.map(w => w.es).join(', ');

  const prompt = `
    Generate ${sentenceCount} simple Spanish sentences for a "${levelTitle}" level learner (CEFR ${cefrBand}).
    Where possible, use words from this pool: [${wordList}].
    Return a valid JSON array of objects with keys: "es" (Spanish sentence), "en" (English translation).
    Example: [{"es": "El perro es grande.", "en": "The dog is big."}]
  `;

  try {
    const responseJson = await gemini_flash.generateJson(prompt); // Using gemini-flash as discussed
    return responseJson;
  } catch (error) {
    console.error("Failed to generate sentences:", error);
    // Return a fallback or empty array on failure
    return [];
  }
}

// --- Helpers ---

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
