// Spanish-app/src/services/badges.js

/**
 * All available badges in the system.
 */
export const BADGES = {
  'first-steps': {
    name: '🎯 First Steps',
    description: 'Answered your first word correctly.',
  },
  'on-a-roll': {
    name: '🔥 On a Roll',
    description: 'Maintained a 3-day practice streak.',
  },
  'week-warrior': {
    name: '🔥 Week Warrior',
    description: 'Maintained a 7-day practice streak.',
  },
  'monthly-legend': {
    name: '🔥 Monthly Legend',
    description: 'Maintained a 30-day practice streak!',
  },
  'halfway-there': {
    name: '⭐ Halfway There',
    description: 'Reached 50% progress in your current band.',
  },
  'sharp-mind': {
    name: '⚡ Sharp Mind',
    description: 'Got 10 correct answers in a row in a single session.',
  },
  'night-owl': {
    name: '🌙 Night Owl',
    description: 'Completed a practice session after 10 PM.',
  },
  'foundation-master': {
    name: '🏆 Foundation Master',
    description: 'Completed 100% of the A1 "Foundations" band.',
  },
  'first-stretch': {
    name: '🚀 First Stretch',
    description: 'Encountered your first word from the next CEFR band.',
  },
  'elementary-master': {
    name: '💎 Elementary Master',
    description: 'Completed 100% of the A2 "Elementary" band.',
  },
};

/**
 * Checks which new badges a user has earned based on their updated profile
 * and the results of their last session.
 *
 * @param {object} updatedProfile - The user's profile *after* the session.
 * @param {array} sessionResults - The results from the completed session.
 * @returns {array} An array of badge IDs for newly earned badges.
 */
export function checkNewBadges(updatedProfile, sessionResults) {
  const newBadges = [];
  const { badges, streak, bandProgress, cefrBand } = updatedProfile;
  const alreadyEarned = new Set(badges);

  // Streak Badges
  if (streak >= 3 && !alreadyEarned.has('on-a-roll')) newBadges.push('on-a-roll');
  if (streak >= 7 && !alreadyEarned.has('week-warrior')) newBadges.push('week-warrior');
  if (streak >= 30 && !alreadyEarned.has('monthly-legend')) newBadges.push('monthly-legend');

  // Progress Badges
  if (bandProgress >= 0.5 && !alreadyEarned.has('halfway-there')) newBadges.push('halfway-there');
  if (bandProgress >= 1.0) {
    if (cefrBand === 'A1' && !alreadyEarned.has('foundation-master')) newBadges.push('foundation-master');
    if (cefrBand === 'A2' && !alreadyEarned.has('elementary-master')) newBadges.push('elementary-master');
  }

  // Session-Specific Badges
  if (sessionResults.length > 0 && !alreadyEarned.has('first-steps')) {
    if (sessionResults.some(r => r.correct)) newBadges.push('first-steps');
  }
  
  // Check for 10 correct in a row
  if (sessionResults.filter(r => r.correct).length >= 10 && !alreadyEarned.has('sharp-mind')) {
     let consecutive = 0;
     for (const result of sessionResults) {
        if (result.correct) consecutive++;
        else consecutive = 0;
        if (consecutive >= 10) {
           newBadges.push('sharp-mind');
           break;
        }
     }
  }

  // Check if any "stretch" words were introduced
  const stretchWord = sessionResults.find(r => r.isStretch); // Requires `isStretch` flag from contentResolver
  if (stretchWord && !alreadyEarned.has('first-stretch')) newBadges.push('first-stretch');

  // Time-based Badges
  const now = new Date();
  if (now.getHours() >= 22 && !alreadyEarned.has('night-owl')) newBadges.push('night-owl');

  return newBadges;
}
