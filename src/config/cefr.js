// Spanish-app/src/config/cefr.js

/**
 * Single source of truth for the CEFR Progression System.
 * Contains level titles, band structures, and calculation constants.
 *
 * NOTE: Users never see "A1" or "CEFR". They see descriptive titles.
 */

export const CEFR_LEVELS = {
  A1: 'Foundations',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

export const TOTAL_LEVELS_PER_BAND = 10;
export const TOTAL_BANDS_IMPLEMENTED = 2; // A1, A2
export const TOTAL_LEVELS = TOTAL_LEVELS_PER_BAND * TOTAL_BANDS_IMPLEMENTED; // 40 planned, 20 for now

export const LEVEL_TITLES = {
  A1: [
    'Newcomer',       // 0-10%
    'Beginner',       // 10-20%
    'Student',        // 20-30%
    'Explorer',       // 30-40%
    'Apprentice',     // 40-50%
    'Practitioner',   // 50-60%
    'Speaker',        // 60-70%
    'Conversationalist',// 70-80%
    'Achiever',       // 80-90%
    'Foundation Master' // 90-100%
  ],
  A2: [
    'Elementary',     // 0-10%
    'Traveller',      // 10-20%
    'Navigator',      // 20-30%
    'Communicator',   // 30-40%
    'Builder',        // 40-50%
    'Connector',      // 50-60%
    'Storyteller',    // 60-70%
    'Debater',        // 70-80%
    'Fluent',         // 80-90%
    'Elementary Master'// 90-100%
  ],
  // B1 and B2 are placeholders to demonstrate system extensibility.
  // The architecture supports them, but content is not yet available.
  B1: Array(10).fill('Intermediate'),
  B2: Array(10).fill('Upper-Intermediate'),
};

/**
 * Constants for the Content Resolver logic.
 * Defines the mix of words served in a session.
 */
export const CONTENT_BUCKET_SHARES = {
  CURRENT: 0.65, // Current band, not yet mastered
  REVIEW: 0.15,  // Any band, mastered (spaced repetition)
  STRETCH: 0.15, // Next band, brand new words
  WEAK: 0.05,    // Any band, very low accuracy
};

/**
 * Maximum number of new "stretch" words to introduce in a single session.
 * This prevents overwhelming the user.
 */
export const MAX_NEW_WORDS_PER_SESSION = 5;

/**
 * The initial user profile state for schema v3.
 * Used when a new user signs up or when v2 data is wiped.
 */
export const INITIAL_USER_PROFILE_V3 = {
  schemaVersion: 3,
  cefrBand: 'A1',
  sublevel: 0,
  bandProgress: 0.0,
  bandStrength: 0.0,
  wordExposure: {},
  badges: [],
  streak: 0,
  lastSessionDate: null,
  totalWordsIntroduced: 0,
  totalCorrect: 0,
  totalAttempts: 0,
};
