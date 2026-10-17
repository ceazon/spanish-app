import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FSRS_DESIRED_RETENTION,
  FSRS_MAX_INTERVAL_DAYS,
  fsrsIntervalDays,
  fsrsRetrievability,
  fsrsReview,
  gradeFromWordResult,
  seedFsrsState,
} from './fsrs.js';

test('new word scheduled with FSRS initial stability', () => {
  const r = fsrsReview({ difficulty: null, stability: null, grade: 3, nowMs: Date.now() });
  assert.ok(r.difficulty >= 1 && r.difficulty <= 10);
  assert.ok(r.stability > 0);
  assert.ok(r.intervalDays > 0 && r.intervalDays <= FSRS_MAX_INTERVAL_DAYS);
  assert.ok(Number.isFinite(new Date(r.nextReviewAt).getTime()));
});

test('repeated good reviews grow the interval (no 14-day cap)', () => {
  const now = Date.now();
  let s = fsrsReview({ difficulty: null, stability: null, grade: 3, nowMs: now });
  let at = now;
  for (let i = 0; i < 4; i++) {
    at += s.intervalDays * 86400000;
    const prev = s.intervalDays;
    s = fsrsReview({ difficulty: s.difficulty, stability: s.stability, lastSeenMs: at - s.intervalDays * 86400000, grade: 3, nowMs: at });
    assert.ok(s.intervalDays >= prev, `interval should not shrink on good recall (got ${s.intervalDays} after ${prev})`);
  }
  assert.ok(s.intervalDays > 14, `expected FSRS to exceed the old 14-day cap, got ${s.intervalDays}`);
});

test('a lapse shortens the interval and raises difficulty', () => {
  const now = Date.now();
  const learned = fsrsReview({ difficulty: 4, stability: 30, lastSeenMs: now - 60 * 86400000, grade: 1, nowMs: now });
  assert.ok(learned.stability < 30, 'lapse should reduce stability');
  assert.ok(learned.difficulty > 4, 'lapse should raise difficulty');
  assert.ok(learned.intervalDays < 30, 'lapse should pull the review forward');
});

test('retrievability at one stability-length is ~desired retention', () => {
  const r = fsrsRetrievability(10, 10);
  assert.ok(Math.abs(r - FSRS_DESIRED_RETENTION) < 0.01, `expected ~0.9, got ${r}`);
});

test('legacy entries warm-start without resetting progress', () => {
  const strong = seedFsrsState({ seen: 20, correct: 19, legacyStability: 5 });
  const weak = seedFsrsState({ seen: 2, correct: 1, legacyStability: 0 });
  assert.ok(strong.stability > weak.stability, 'stronger history should seed longer stability');
  assert.ok(strong.difficulty < weak.difficulty, 'higher accuracy should seed lower difficulty');
});

test('grade mapping: incorrect=Again, hint=Hard, clean=Good', () => {
  assert.equal(gradeFromWordResult({ correct: 0 }), 1);
  assert.equal(gradeFromWordResult({ correct: 1, hintUsed: true }), 2);
  assert.equal(gradeFromWordResult({ correct: 1 }), 3);
});

test('intervals stay within sane bounds', () => {
  assert.ok(fsrsIntervalDays(0.001) >= 4 / 24, 'tiny stability still schedules hours out');
  assert.ok(fsrsIntervalDays(10000) <= FSRS_MAX_INTERVAL_DAYS, 'huge stability is capped');
});
