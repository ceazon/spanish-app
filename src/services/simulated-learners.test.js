import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressionScenarioReport } from './progression-scenarios.js';

const report = buildProgressionScenarioReport();
const byName = Object.fromEntries(report.scenarios.map((s) => [s.name, s]));

test('progression scenarios: fast starter levels up quickly', () => {
  const fast = byName['Fast starter'];
  assert.ok(fast, 'Fast starter scenario missing');
  assert.ok((fast.milestones.level2AtLesson || 999) <= 3, 'Fast starter should reach level 2 very early');
  assert.ok((fast.milestones.level3AtLesson || 999) <= 8, 'Fast starter should reach level 3 quickly');
  assert.ok(fast.quality.maxPlateauLessons < fast.config.sessions, 'Fast starter should not hard-deadlock for an entire run');
});

test('progression scenarios: steady learner progresses without deadlock', () => {
  const steady = byName['Steady learner'];
  assert.ok(steady, 'Steady learner scenario missing');
  assert.ok((steady.final.overallLevel || 1) >= 2, 'Steady learner should progress above level 1');
  assert.ok(steady.quality.maxPlateauLessons < steady.config.sessions, 'Steady learner should not hard-deadlock for an entire run');
});

test('progression scenarios: struggling learner still makes measurable progress', () => {
  const slow = byName['Struggling but consistent'];
  assert.ok(slow, 'Struggling scenario missing');
  assert.ok((slow.final.bandProgressPct || 0) >= 10, 'Struggling learner should still gain measurable progress');
  assert.ok((slow.final.overallLevel || 1) >= 1, 'Struggling learner should remain on valid level path');
});

test('progression scenarios: stretch-heavy learner accumulates future-band momentum', () => {
  const stretch = byName['Stretch-heavy learner'];
  assert.ok(stretch, 'Stretch scenario missing');
  assert.ok((stretch.quality.futureBandMomentum || 0) > 0, 'Stretch learner should accumulate future-band momentum');
});
