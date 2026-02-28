// Spanish-app/src/config/cefr.js

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
    'Newcomer', 'Beginner', 'Student', 'Explorer', 'Apprentice',
    'Practitioner', 'Speaker', 'Conversationalist', 'Achiever', 'Foundation Master'
  ],
  A2: [
    'Elementary', 'Traveller', 'Navigator', 'Communicator', 'Builder',
    'Connector', 'Storyteller', 'Debater', 'Fluent', 'Elementary Master'
  ],
  B1: Array(10).fill('Intermediate'),
  B2: Array(10).fill('Upper-Intermediate'),
};

export const CONTENT_BUCKET_SHARES = {
  CURRENT: 0.65,
  REVIEW: 0.15,
  STRETCH: 0.15,
  WEAK: 0.05,
};

export const MAX_NEW_WORDS_PER_SESSION = 5;

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
