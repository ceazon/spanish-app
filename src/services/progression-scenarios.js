import { defaultLearningState, updateLearningProfile } from './progression.js';
import vocab from '../content/cefr-vocab-master.json' with { type: 'json' };

const MODULE_ROTATION = ['Flashcards', 'Word Match', 'Fill in the Blank', 'Sentence Scramble'];

function makeSessionWordResults({ profile, pool, lessonIndex, wordsPerSession, accuracy, stretchEvery = 0 }) {
  const start = (lessonIndex * 3) % Math.max(1, pool.length);
  const items = [];
  for (let i = 0; i < wordsPerSession; i += 1) {
    items.push(pool[(start + i) % pool.length]);
  }

  const correctN = Math.max(0, Math.min(items.length, Math.round(items.length * accuracy)));
  return items.map((w, i) => {
    const bucket = stretchEvery > 0 && i % stretchEvery === 0 ? 'stretch_next_band' : 'current';
    return {
      id: w?.id || w?.es || `${profile.cefrBand}:${lessonIndex}:${i}`,
      cefr: bucket === 'stretch_next_band' ? (profile.cefrBand === 'A1' ? 'A2' : profile.cefrBand) : (w?.cefr || profile.cefrBand || 'A1'),
      seen: 1,
      correct: i < correctN ? 1 : 0,
      bucket,
    };
  });
}

export function runProgressionScenario(config = {}) {
  const {
    name = 'scenario',
    sessions = 24,
    wordsPerSession = 10,
    accuracy = 0.75,
    stretchEvery = 0,
    pointsPerCorrect = 10,
    moduleRotation = MODULE_ROTATION,
  } = config;

  const a1Pool = (vocab?.words || []).filter((w) => (w?.cefr || 'A1') === 'A1');
  const pool = a1Pool.length ? a1Pool : (vocab?.words || []);

  let profile = defaultLearningState();
  const snapshots = [];

  for (let s = 0; s < sessions; s += 1) {
    const wordResults = makeSessionWordResults({
      profile,
      pool,
      lessonIndex: s,
      wordsPerSession,
      accuracy,
      stretchEvery,
    });
    const correct = wordResults.reduce((n, r) => n + Number(r?.correct || 0), 0);

    profile = updateLearningProfile(profile, {
      lessonType: moduleRotation[s % moduleRotation.length] || 'Flashcards',
      attemptedAt: new Date(Date.now() + s * 60000).toISOString(),
      points: correct * pointsPerCorrect,
      correct,
      total: wordResults.length,
      wordResults,
    });

    snapshots.push({
      lesson: s + 1,
      overallLevel: Number(profile?.overallLevel || 1),
      cefrBand: profile?.cefrBand || 'A1',
      bandProgress: Number(profile?.bandProgress || 0),
      learningProgress: Number(profile?.learningProgress || 0),
      gatePass: !!profile?.gateStatus?.pass,
      rawGatePass: !!profile?.gateStatus?.rawPass,
      onboardingBypass: !!profile?.gateStatus?.onboardingBypass,
    });
  }

  const levelAt = (target) => snapshots.find((x) => x.overallLevel >= target)?.lesson || null;
  let maxPlateau = 1;
  let curPlateau = 1;
  for (let i = 1; i < snapshots.length; i += 1) {
    const same = snapshots[i].overallLevel === snapshots[i - 1].overallLevel
      && Math.abs(snapshots[i].bandProgress - snapshots[i - 1].bandProgress) < 0.00001;
    if (same) {
      curPlateau += 1;
      if (curPlateau > maxPlateau) maxPlateau = curPlateau;
    } else {
      curPlateau = 1;
    }
  }

  const pointsByBand = profile?.progressPointsByBand || {};
  const futureBand = profile?.cefrBand === 'A1' ? 'A2' : null;
  const futureMomentum = futureBand ? Number(pointsByBand?.[futureBand] || 0) : 0;

  return {
    name,
    config: { sessions, wordsPerSession, accuracy, stretchEvery },
    final: {
      overallLevel: Number(profile?.overallLevel || 1),
      cefrBand: profile?.cefrBand || 'A1',
      bandProgressPct: Math.round(Number(profile?.bandProgress || 0) * 100),
    },
    milestones: {
      level2AtLesson: levelAt(2),
      level3AtLesson: levelAt(3),
      level4AtLesson: levelAt(4),
    },
    quality: {
      maxPlateauLessons: maxPlateau,
      futureBandMomentum: futureMomentum,
      learnedVocabulary: Number(profile?.vocabularySize || 0),
    },
    snapshots,
  };
}

export function buildProgressionScenarioReport() {
  const scenarios = [
    runProgressionScenario({ name: 'Fast starter', sessions: 20, wordsPerSession: 12, accuracy: 0.9, stretchEvery: 5 }),
    runProgressionScenario({ name: 'Steady learner', sessions: 28, wordsPerSession: 10, accuracy: 0.75, stretchEvery: 6 }),
    runProgressionScenario({ name: 'Struggling but consistent', sessions: 36, wordsPerSession: 10, accuracy: 0.6, stretchEvery: 7 }),
    runProgressionScenario({ name: 'Stretch-heavy learner', sessions: 24, wordsPerSession: 10, accuracy: 0.78, stretchEvery: 3 }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    scenarios,
  };
}
