// Spanish-app/src/config/cefr.js

/**
 * Maps CEFR bands to friendly labels.
 */
export const CEFR_BANDS = {
  A1: 'Foundations',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

/**
 * 10 user-friendly sub-levels per CEFR band.
 * Progression happens every 10% of band completion.
 */
export const LEVEL_TITLES = {
  A1: [
    'Newcomer',
    'Beginner',
    'Student',
    'Explorer',
    'Apprentice',
    'Practitioner',
    'Speaker',
    'Conversationalist',
    'Achiever',
    'Foundation Master'
  ],
  A2: [
    'Elementary',
    'Traveller',
    'Navigator',
    'Communicator',
    'Builder',
    'Connector',
    'Storyteller',
    'Debater',
    'Fluent',
    'Elementary Master'
  ],
  // B1+ can reuse titles or have unique ones later
  B1: Array(10).fill('Intermediate'),
  B2: Array(10).fill('Upper-Intermediate'),
};

export const TOTAL_LEVELS_PER_BAND = 10;

/**
 * Helper to get the friendly title and overall numeric level (1-40).
 */
export function getLevelLabel(cefrBand, progress) {
  const bandIndex = ['A1', 'A2', 'B1', 'B2'].indexOf(cefrBand);
  const sublevel = Math.min(9, Math.floor(progress * 10));

  const title = LEVEL_TITLES[cefrBand]?.[sublevel] || 'Learner';
  const nextTitle = LEVEL_TITLES[cefrBand]?.[Math.min(sublevel + 1, 9)] || title;
  const overallLevel = (bandIndex * 10) + sublevel + 1;
  const pctWithinSublevel = Math.round((progress * 10 - sublevel) * 100);

  return { title, nextTitle, overallLevel, sublevel, pctWithinSublevel };
}
