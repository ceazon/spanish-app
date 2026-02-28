// Spanish-app/src/services/storage.js

import { migrateProfile } from './progression';

const PROFILE_KEY = 'chadlingo_profile';

export function loadProfile() {
  try {
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    const profile = rawProfile ? JSON.parse(rawProfile) : null;
    return migrateProfile(profile);
  } catch (error) {
    console.error("Failed to load profile, resetting:", error);
    return migrateProfile(null);
  }
}

export function saveProfile(profile) {
  try {
    const profileString = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, profileString);
  } catch (error) {
    console.error("Failed to save profile:", error);
  }
}
