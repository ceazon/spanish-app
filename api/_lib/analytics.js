import { Redis } from "@upstash/redis";

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : null;

function dayStamp(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10);
}

function daysBack(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dayStamp(d));
  }
  return out;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function isAnalyticsConfigured() {
  return !!redis;
}

async function ensureConfigured() {
  if (!redis) throw new Error("Redis/KV not configured. Add KV_REST_API_URL + KV_REST_API_TOKEN in Vercel.");
}

export async function trackEvent(payload = {}) {
  await ensureConfigured();
  const eventType = payload?.eventType;
  const username = String(payload?.username || "").trim().toLowerCase();
  if (!eventType || !username) return { ok: false, ignored: true };

  const nowIso = new Date().toISOString();
  const day = dayStamp();
  const userKey = `analytics:user:${username}`;
  await redis.incrby("analytics:totals:events", 1);
  await redis.set("analytics:lastEventAt", nowIso);
  const activeSetKey = `analytics:active:${day}`;
  const registrationSetKey = `analytics:registrations:${day}`;

  await redis.sadd("analytics:users", username);
  await redis.sadd(activeSetKey, username);
  await redis.expire(activeSetKey, 60 * 60 * 24 * 120);

  if (eventType === "register") {
    await redis.sadd(registrationSetKey, username);
    await redis.expire(registrationSetKey, 60 * 60 * 24 * 365);
    await redis.hset(userKey, {
      username,
      displayName: payload?.displayName || username,
      joined: payload?.joined || nowIso,
      lastLogin: payload?.lastLogin || nowIso,
      points: toNumber(payload?.points),
      lessons: toNumber(payload?.lessons),
    });
  }

  if (eventType === "login") {
    await redis.hset(userKey, {
      username,
      displayName: payload?.displayName || username,
      lastLogin: payload?.lastLogin || nowIso,
    });
  }

  if (eventType === "lesson_complete") {
    const earnedPoints = toNumber(payload?.earnedPoints);
    const durationSec = toNumber(payload?.durationSec);
    const progressPoints = toNumber(payload?.progressPointsEarned);
    const strengthPoints = toNumber(payload?.strengthPointsEarned);

    await redis.incrby("analytics:totals:lessons", 1);
    await redis.incrby("analytics:totals:points", earnedPoints);
    await redis.incrby("analytics:totals:activeSec", durationSec);
    await redis.incrbyfloat("analytics:totals:progressPoints", progressPoints);
    await redis.incrbyfloat("analytics:totals:strengthPoints", strengthPoints);

    if (payload?.lessonType) {
      await redis.hincrby("analytics:module-counts", payload.lessonType, 1);
      await redis.hincrbyfloat("analytics:module-progress-points", payload.lessonType, progressPoints);
      await redis.hincrbyfloat("analytics:module-strength-points", payload.lessonType, strengthPoints);
    }

    await redis.hset(userKey, {
      username,
      displayName: payload?.displayName || username,
      points: toNumber(payload?.points),
      lessons: toNumber(payload?.lessons),
      lastLogin: nowIso,
      lastProgressPoints: progressPoints,
      lastStrengthPoints: strengthPoints,
    });
  }

  return { ok: true };
}

async function uniqueUsersFromDailySets(prefix, dayCount) {
  const stamps = daysBack(dayCount);
  const all = await Promise.all(stamps.map((d) => redis.smembers(`${prefix}:${d}`)));
  const union = new Set();
  all.forEach((arr) => (arr || []).forEach((u) => union.add(String(u))));
  return union.size;
}

export async function getStats() {
  await ensureConfigured();

  const [
    totalUsers,
    totalLessons,
    totalPoints,
    totalActiveSec,
    totalProgressPoints,
    totalStrengthPoints,
    topModulesRaw,
    moduleProgressRaw,
    moduleStrengthRaw,
  ] = await Promise.all([
    redis.scard("analytics:users"),
    redis.get("analytics:totals:lessons"),
    redis.get("analytics:totals:points"),
    redis.get("analytics:totals:activeSec"),
    redis.get("analytics:totals:progressPoints"),
    redis.get("analytics:totals:strengthPoints"),
    redis.hgetall("analytics:module-counts"),
    redis.hgetall("analytics:module-progress-points"),
    redis.hgetall("analytics:module-strength-points"),
  ]);

  const [newThisWeek, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
    uniqueUsersFromDailySets("analytics:registrations", 7),
    uniqueUsersFromDailySets("analytics:active", 7),
    uniqueUsersFromDailySets("analytics:active", 30),
  ]);

  const topLessons = Object.entries(topModulesRaw || {})
    .map(([name, count]) => [name, toNumber(count)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const moduleProgressDiagnostics = Object.entries(topModulesRaw || {})
    .map(([name, lessonCountRaw]) => {
      const lessons = toNumber(lessonCountRaw);
      const progress = toNumber(moduleProgressRaw?.[name]);
      const strength = toNumber(moduleStrengthRaw?.[name]);
      return {
        lesson: name,
        lessons,
        progressPoints: Number(progress.toFixed(2)),
        strengthPoints: Number(strength.toFixed(2)),
        avgProgressPerLesson: lessons > 0 ? Number((progress / lessons).toFixed(2)) : 0,
        avgStrengthPerLesson: lessons > 0 ? Number((strength / lessons).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.avgProgressPerLesson - a.avgProgressPerLesson)
    .slice(0, 10);

  const lessonsNum = toNumber(totalLessons);
  const progressNum = toNumber(totalProgressPoints);
  const strengthNum = toNumber(totalStrengthPoints);

  return {
    totalUsers: toNumber(totalUsers),
    newThisWeek,
    weeklyActiveUsers,
    monthlyActiveUsers,
    totalLessons: lessonsNum,
    totalPoints: toNumber(totalPoints),
    totalActiveMinutes: Math.round(toNumber(totalActiveSec) / 60),
    totalProgressPoints: Number(progressNum.toFixed(2)),
    totalStrengthPoints: Number(strengthNum.toFixed(2)),
    avgProgressPerLesson: lessonsNum > 0 ? Number((progressNum / lessonsNum).toFixed(2)) : 0,
    avgStrengthPerLesson: lessonsNum > 0 ? Number((strengthNum / lessonsNum).toFixed(2)) : 0,
    topLessons,
    moduleProgressDiagnostics,
  };
}

export async function getUsers(limit = 200) {
  await ensureConfigured();
  const usernames = (await redis.smembers("analytics:users")) || [];
  const sliced = usernames.slice(0, Math.max(1, Math.min(Number(limit) || 200, 1000)));
  const users = await Promise.all(
    sliced.map(async (u) => {
      const data = (await redis.hgetall(`analytics:user:${u}`)) || {};
      return {
        username: String(data?.username || u),
        displayName: data?.displayName || "",
        joined: data?.joined || null,
        lastLogin: data?.lastLogin || null,
        points: toNumber(data?.points),
        lessons: toNumber(data?.lessons),
      };
    }),
  );

  return users.sort((a, b) => Date.parse(b?.joined || "") - Date.parse(a?.joined || ""));
}

export async function getHealth() {
  if (!isAnalyticsConfigured()) {
    return {
      configured: false,
      status: "missing_config",
      lastEventAt: null,
      totalEvents: 0,
    };
  }

  const [lastEventAt, totalEvents] = await Promise.all([
    redis.get("analytics:lastEventAt"),
    redis.get("analytics:totals:events"),
  ]);

  return {
    configured: true,
    status: "ok",
    lastEventAt: lastEventAt || null,
    totalEvents: toNumber(totalEvents),
  };
}
