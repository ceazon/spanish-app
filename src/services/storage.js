// Spanish-app/src/services/storage.js

import { migrateProfile } from './progression';

const USER_DATA_KEY = 'chadlingo_user';
const PROFILE_KEY = 'chadlingo_profile';

/**
 * Loads the user's learning profile from localStorage.
 * Crucially, it passes the loaded profile through the migration function,
 * which will wipe and reset it if it's an old schema version.
 * @returns {object | null} The user's v3 profile, or null if not found.
 */
export function loadProfile() {
  try {
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    const profile = rawProfile ? JSON.parse(rawProfile) : null;
    // This is the migration step. migrateProfile will return a fresh v3 profile
    // if the loaded one is old, invalid, or null.
    return migrateProfile(profile);
  } catch (error) {
    console.error("Failed to load user profile:", error);
    // On any error, return a fresh profile to prevent app crashes.
    return migrateProfile(null);
  }
}

/**
 * Saves the user's learning profile to localStorage.
 * @param {object} profile - The user's v3 profile to save.
 */
export function saveProfile(profile) {
  try {
    const profileString = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, profileString);
  } catch (error) {
    console.error("Failed to save user profile:", error);
  }
}

/**
 * Note: The original file had logic for `window.storage` and separate user/profile
 * concepts. This is being simplified for the rewrite to a single `profile` object
 * stored directly in localStorage, which is sufficient for the MVP.
 * The `loadUser` and `saveUser` functions are consolidated into `loadProfile`
 * and `saveProfile`.
 */
