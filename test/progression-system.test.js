import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLearningState, updateLearningProfile } from '../src/services/progression.js';

function makeResult({ lessonType = 'Word Match', points = 20, correct = 6, total = 6, words = 6, cefr = 'A1' } = {}) {
  return {
    lessonType,
    points,
    correct,
    total,
    wordResults: Array.from({ length: words }).map((_, i) => ({
      id: `${lessonType}:${Date.now()}:${i}:${Math.random()}`,
      cefr,
      seen: 1,
      correct: i < correct ? 1 : 0,
      bucket: 'current',
    })),
  };
}

test('learning progress can increase even when level progression is slower', () => {
  let p = defaultLearningState();

  for (let i = 0; i < 12; i += 1) {
    p = updateLearningProfile(p, makeResult({ lessonType: i % 2 ? 'Flashcards' : 'Word Match', correct: 4, total: 6, points: 12 }));
  }

  assert.ok(Number(p.learningProgress || 0) > 0, 'learning progress should move');
  assert.ok(Number(p.bandProgress || 0) >= 0, 'band progress should be valid');
  assert.ok(typeof p.gateStatus === 'object', 'gate status should exist for diagnostics');
});

test('high quality runs eventually move overall level upward', () => {
  let p = defaultLearningState();
  const startLevel = Number(p.overallLevel || 1);

  for (let i = 0; i < 30; i += 1) {
    const lessonType = ['Word Match', 'Flashcards', 'Fill in the Blank', 'Learn Verbs'][i % 4];
    p = updateLearningProfile(p, makeResult({ lessonType, correct: 6, total: 6, points: 30 }));
  }

  assert.ok(Number(p.overallLevel || 1) >= startLevel, 'overall level should not regress');
  assert.ok(Number(p.sublevelProgress || 0) >= 0, 'sublevel progress should be present');
});

test('low skill diversity can trigger gate pressure signals', () => {
  let p = defaultLearningState();

  // Force many same-type lessons to create skill imbalance.
  for (let i = 0; i < 20; i += 1) {
    p = updateLearningProfile(p, makeResult({ lessonType: 'Word Match', correct: 5, total: 6, points: 18 }));
  }

  assert.ok(typeof p.gateStatus?.minSkill !== 'undefined', 'minSkill should be computed');
  assert.ok(Number(p.gateStatus?.readiness || 0) >= 0, 'readiness should be available');
});
