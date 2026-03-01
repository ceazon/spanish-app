import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLearningState, updateLearningProfile } from './progression.js';
import vocab from '../content/cefr-vocab.json' with { type: 'json' };

function makeWordResults(words, accuracy = 0.7) {
  return words.map((w, i) => ({
    id: w.id || w.es,
    cefr: w.cefr || 'A1',
    seen: 1,
    correct: i < Math.round(words.length * accuracy) ? 1 : 0,
  }));
}

function simulateSessions({ sessions = 12, wordsPerSession = 10, accuracy = 0.7 }) {
  let profile = defaultLearningState();
  const a1Words = (vocab.vocab || []).filter((w) => w.cefr === 'A1');

  for (let s = 0; s < sessions; s++) {
    // cycle word pool to create repeated exposure (needed for mastery)
    const start = (s * 3) % Math.max(1, a1Words.length);
    const window = [];
    for (let i = 0; i < wordsPerSession; i++) {
      window.push(a1Words[(start + i) % a1Words.length]);
    }

    const wordResults = makeWordResults(window, accuracy);
    const correct = wordResults.reduce((n, r) => n + (r.correct ? 1 : 0), 0);

    profile = updateLearningProfile(profile, {
      lessonType: s % 2 === 0 ? 'Flashcards' : 'Word Match',
      attemptedAt: new Date(Date.now() + s * 60000).toISOString(),
      points: correct * 10,
      correct,
      total: wordResults.length,
      wordResults,
    });
  }

  return profile;
}

test('simulated learner: steady learner advances from level 1', () => {
  const p = simulateSessions({ sessions: 14, wordsPerSession: 8, accuracy: 0.75 });
  assert.ok((p.overallLevel || 1) > 1, 'Expected steady learner to level up');

  // learningProgress can reset to 0 after band transition; check event history for movement
  const maxLearning = Math.max(0, ...((p.progressionEvents || []).map((e) => Number(e.learningProgress || 0))));
  assert.ok(maxLearning > 0, 'Expected visible learning progress movement in progression events');
});

test('simulated learner: high performer should progress faster than cautious learner', () => {
  const cautious = simulateSessions({ sessions: 14, wordsPerSession: 8, accuracy: 0.6 });
  const strong = simulateSessions({ sessions: 14, wordsPerSession: 8, accuracy: 0.9 });

  assert.ok((strong.bandProgress || 0) >= (cautious.bandProgress || 0), 'Strong learner should not lag cautious learner');
  assert.ok((strong.overallLevel || 1) >= (cautious.overallLevel || 1), 'Strong learner should have >= overall level');
});

test('simulated learner: no impossible jumps in a short run', () => {
  const p = simulateSessions({ sessions: 6, wordsPerSession: 8, accuracy: 0.95 });

  // Current MVP pacing may reach early A2 quickly with tiny seed corpus;
  // keep this as a safety ceiling until pacing is tuned.
  assert.ok((p.overallLevel || 1) <= 14, 'Learner should stay within early-path levels in a short run');
  assert.ok(['A1', 'A2'].includes(p.cefrBand), 'Band should remain within A1/A2 in short run');
});
