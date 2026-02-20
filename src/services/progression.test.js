import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDailyQuestState,
  placementFromScore,
  migrateUser,
  updateLearningProfile,
  getAdaptiveDifficulty,
} from './progression.js';

test('placementFromScore returns starter/beginner/intermediate bands', () => {
  assert.equal(placementFromScore(2, 10).level, 'starter');
  assert.equal(placementFromScore(5, 10).level, 'beginner');
  assert.equal(placementFromScore(8, 10).level, 'intermediate');
});

test('daily quests mark done correctly', () => {
  const now = new Date('2026-02-19T12:00:00Z');
  const history = [
    { date: '2026-02-19T08:00:00Z', points: 30, type: 'Flashcards' },
    { date: '2026-02-19T09:00:00Z', points: 25, type: 'Transcription' },
    { date: '2026-02-18T09:00:00Z', points: 999, type: 'Transcription' },
  ];
  const { quests, todayPts, todayLessons, todayListening } = getDailyQuestState(history, now);
  assert.equal(todayPts, 55);
  assert.equal(todayLessons, 2);
  assert.equal(todayListening, 1);
  assert.equal(quests.every(q => q.done), true);
});

test('migrate user + adaptive progression keeps profile across versions', () => {
  const userV1 = {
    username: 'test',
    profile: { level: 'beginner', recommendedLessons: ['Learn Verbs'] },
  };
  const migrated = migrateUser(userV1);
  assert.equal(migrated.profile.schemaVersion, 2);
  assert.equal(Array.isArray(migrated.profile.recommendedLessons), true);

  const updated = updateLearningProfile(migrated.profile, {
    lessonType: 'Learn Verbs',
    points: 80,
    correct: 8,
    total: 10,
  });

  assert.equal(updated.mastery['Learn Verbs'].attempts, 1);
  assert.ok(updated.xp > 0);
  assert.ok(updated.recommendedLessons.length > 0);
  assert.ok(getAdaptiveDifficulty(updated, 'Learn Verbs') >= 1);
});
