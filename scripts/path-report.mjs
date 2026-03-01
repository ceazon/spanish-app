#!/usr/bin/env node
import { defaultLearningState, updateLearningProfile } from '../src/services/progression.js';
import vocab from '../src/content/cefr-vocab.json' with { type: 'json' };

function makeWordResults(words, accuracy = 0.7) {
  return words.map((w, i) => ({
    id: w.id || w.es,
    cefr: w.cefr || 'A1',
    seen: 1,
    correct: i < Math.round(words.length * accuracy) ? 1 : 0,
  }));
}

function runPersona({ label, sessions = 14, wordsPerSession = 8, accuracy = 0.75 }) {
  let profile = defaultLearningState();
  const a1 = (vocab.vocab || []).filter((w) => w.cefr === 'A1');

  for (let s = 0; s < sessions; s++) {
    const start = (s * 3) % Math.max(1, a1.length);
    const win = [];
    for (let i = 0; i < wordsPerSession; i++) win.push(a1[(start + i) % a1.length]);
    const wordResults = makeWordResults(win, accuracy);
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

  return { label, profile };
}

function recommendationFromRuns(runs) {
  const byLabel = Object.fromEntries(runs.map((r) => [r.label, r.profile]));
  const steady = byLabel.steady;
  const strong = byLabel.strong;
  const cautious = byLabel.cautious;

  const recs = [];

  if ((steady?.overallLevel || 1) <= 2) {
    recs.push('Steady learners are progressing too slowly. Consider slightly increasing review-to-current conversion.');
  }

  if ((strong?.overallLevel || 1) - (cautious?.overallLevel || 1) < 1) {
    recs.push('High performers are not separating enough from cautious learners. Consider increasing reward for consistent high accuracy.');
  }

  if ((strong?.overallLevel || 1) > 14) {
    recs.push('Progression may be too fast for strong learners in short windows. Keep sublevel smoothing or tighten mastery gates.');
  }

  if (!recs.length) {
    recs.push('Pacing looks healthy across personas. Continue module-by-module rollout and monitor real telemetry.');
  }

  return recs;
}

const runs = [
  runPersona({ label: 'cautious', accuracy: 0.6 }),
  runPersona({ label: 'steady', accuracy: 0.75 }),
  runPersona({ label: 'strong', accuracy: 0.9 }),
];

console.log('\n=== Chadlingo Path Simulation Report ===\n');
for (const { label, profile } of runs) {
  console.log(`${label.toUpperCase()}`);
  console.log(`  Level: ${profile.levelTitle} (${profile.overallLevel})`);
  console.log(`  Band: ${profile.cefrBand}`);
  console.log(`  Mastery Progress: ${Math.round((profile.bandProgress || 0) * 100)}%`);
  console.log(`  Learning Progress: ${Math.round((profile.learningProgress || 0) * 100)}%`);
  console.log('');
}

console.log('Recommendations:');
for (const r of recommendationFromRuns(runs)) {
  console.log(`- ${r}`);
}
console.log('');
