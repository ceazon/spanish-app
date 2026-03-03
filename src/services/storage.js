import { migrateUser, defaultLearningState } from "./progression";

const FORCE_RESET_PROFILE_VERSION = "v4-reset-2026-03-02";

function hasWindowStorage() {
  return typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
}

function getLocal(key) {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(key);
  return value ? { value } : null;
}

function setLocal(key, value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
}

export async function loadUser(username) {
  const key = `user:${username}`;
  try {
    const r = hasWindowStorage() ? await window.storage.get(key) : getLocal(key);
    if (!r) return null;

    const parsed = migrateUser(JSON.parse(r.value));
    const resetVersion = parsed?.profile?.resetVersion;
    if (resetVersion === FORCE_RESET_PROFILE_VERSION) return parsed;

    // One-time global progression reset for v4 rollout.
    const resetUser = {
      ...parsed,
      history: [],
      profile: {
        ...defaultLearningState(),
        resetVersion: FORCE_RESET_PROFILE_VERSION,
      },
    };

    try {
      const value = JSON.stringify(resetUser);
      if (hasWindowStorage()) await window.storage.set(key, value);
      else setLocal(key, value);
    } catch {
      try { setLocal(key, JSON.stringify(resetUser)); } catch {}
    }

    return resetUser;
  } catch {
    return null;
  }
}

export async function saveUser(user) {
  const key = `user:${user.username}`;
  const value = JSON.stringify(user);
  try {
    if (hasWindowStorage()) await window.storage.set(key, value);
    else setLocal(key, value);
  } catch {
    try { setLocal(key, value); } catch {}
  }
}

export async function loadActiveContentPack() {
  const key = "contentPack:active";
  try {
    const raw = hasWindowStorage() ? await window.storage.get(key) : getLocal(key);
    return raw?.value ? JSON.parse(raw.value) : null;
  } catch {
    return null;
  }
}

export async function saveActiveContentPack(pack) {
  const key = "contentPack:active";
  const value = JSON.stringify(pack);
  try {
    if (hasWindowStorage()) await window.storage.set(key, value);
    else setLocal(key, value);
  } catch {
    try { setLocal(key, value); } catch {}
  }
}

export async function clearActiveContentPack() {
  const key = "contentPack:active";
  try {
    if (hasWindowStorage() && typeof window.storage.del === "function") {
      await window.storage.del(key);
      return;
    }
  } catch {}

  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {}
}
