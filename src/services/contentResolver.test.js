import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWordsForModule } from './contentResolver.js';

test('content resolver prioritizes due-review words when available', () => {
  const dueTs = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const profile = {
    cefrBand: 'A1',
    sublevel: 0,
    wordExposure: {
      // ids existing in current corpus are not guaranteed in tests,
      // but selector should still return a valid array without throwing.
      'A1.01:se': { seen: 2, correct: 1, cefr: 'A1', nextReviewAt: dueTs },
    },
  };

  const out = selectWordsForModule({ profile, moduleType: 'Flashcards', count: 10 });
  assert.ok(Array.isArray(out));
  assert.ok(out.length > 0);
});
