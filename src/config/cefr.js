// Spanish-app/src/config/cefr.js

export const CEFR_BANDS = {
  A1: 'Foundations',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

// V4: 20 micro-levels per band
export const LEVEL_TITLES = {
  A1: [
    'Newcomer I','Newcomer II','Beginner I','Beginner II','Student I','Student II','Explorer I','Explorer II','Apprentice I','Apprentice II',
    'Practitioner I','Practitioner II','Speaker I','Speaker II','Conversationalist I','Conversationalist II','Achiever I','Achiever II','Foundation Master I','Foundation Master II'
  ],
  A2: [
    'Elementary I','Elementary II','Traveller I','Traveller II','Navigator I','Navigator II','Communicator I','Communicator II','Builder I','Builder II',
    'Connector I','Connector II','Storyteller I','Storyteller II','Debater I','Debater II','Fluent I','Fluent II','Elementary Master I','Elementary Master II'
  ],
  B1: Array(20).fill('Intermediate'),
  B2: Array(20).fill('Upper-Intermediate'),
};

export const TOTAL_LEVELS_PER_BAND = 20;

export function getLevelLabel(cefrBand, progress) {
  const bandIndex = ['A1', 'A2', 'B1', 'B2'].indexOf(cefrBand);
  const clamped = Math.max(0, Math.min(0.9999, Number(progress || 0)));
  const microLevel = Math.min(19, Math.floor(clamped * TOTAL_LEVELS_PER_BAND));

  const title = LEVEL_TITLES[cefrBand]?.[microLevel] || 'Learner';
  const nextTitle = LEVEL_TITLES[cefrBand]?.[Math.min(microLevel + 1, 19)] || title;
  const overallLevel = (Math.max(0, bandIndex) * TOTAL_LEVELS_PER_BAND) + microLevel + 1;
  const pctWithinMicro = Math.round((clamped * TOTAL_LEVELS_PER_BAND - microLevel) * 100);

  // Back-compat for older callers that use sublevel (0..9)
  const sublevel = Math.floor(microLevel / 2);
  const pctWithinSublevel = Math.round((((clamped * 10) - sublevel)) * 100);

  return { title, nextTitle, overallLevel, sublevel, pctWithinSublevel, microLevel, pctWithinMicro };
}
