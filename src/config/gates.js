export const GATE_POLICY_V1 = {
  version: 1,
  defaultCooldownMin: 30,
  maxAttemptsBeforeAssist: 3,

  gateLevels: [
    { level: 5, type: "checkpoint" },
    { level: 10, type: "band" },
    { level: 15, type: "checkpoint" },
    { level: 20, type: "band" },
    { level: 25, type: "checkpoint" },
    { level: 30, type: "band" },
    { level: 35, type: "checkpoint" },
    { level: 40, type: "band" },
  ],

  rulesByType: {
    checkpoint: {
      totalQuestions: 12,
      timed: true,
      timeLimitSec: 10 * 60,
      passScorePct: 75,
      minSectionPct: 60,
      sectionWeights: {
        vocab: 0.3,
        grammar: 0.25,
        listening: 0.2,
        production: 0.25,
      },
      composition: [
        { section: "vocab", count: 4 },
        { section: "grammar", count: 3 },
        { section: "listening", count: 2 },
        { section: "production", count: 3 },
      ],
    },

    band: {
      totalQuestions: 20,
      timed: true,
      timeLimitSec: 20 * 60,
      passScorePct: 80,
      minSectionPct: 70,
      sectionWeights: {
        vocab: 0.25,
        grammar: 0.25,
        listening: 0.25,
        production: 0.25,
      },
      composition: [
        { section: "vocab", count: 5 },
        { section: "grammar", count: 5 },
        { section: "listening", count: 5 },
        { section: "production", count: 5 },
      ],
    },
  },

  assistLadder: [
    { afterFailures: 1, cooldownMin: 15, unlockHintMode: true },
    { afterFailures: 2, cooldownMin: 20, forceRecoveryPath: true },
    { afterFailures: 3, cooldownMin: 30, lowerPassByPct: 3 },
  ],
};

export const GATE_SECTION_KEYS = ["vocab", "grammar", "listening", "production"];

export function gateKeyFromLevel(level) {
  return `L${Number(level) || 0}`;
}
