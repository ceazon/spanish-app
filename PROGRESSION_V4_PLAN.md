# Progression V4 Plan (A1/A2 Expansion)

## Goal
Build a richer CEFR progression system powered by a large canonical word corpus and micro-level progression.

## Target Architecture
- CEFR bands: A1, A2 (expandable to B1+)
- Micro-levels: 20 per band
- Total levels now: 40
- Selection mix: 70% current, 20% review, 10% stretch

## Phase 1 — Canonical Corpus + Tooling
1. Build `src/content/cefr-vocab-master.json`
2. Add metadata per word:
   - `id`, `es`, `en`, `cefr`, `microLevel`, `topic`, `frequencyRank`
3. Add scripts:
   - `npm run content:build-master`
   - `npm run content:validate-master`

## Phase 2 — Progression Engine v4
1. New profile shape (no migration required):
   - `cefrBand`, `microLevel`, `wordExposure`, `skillMastery`, `xp`
2. Promotion gates:
   - coverage threshold
   - mastery threshold
   - skill-balance threshold

## Phase 3 — Resolver + Modules
1. Route all module content through shared resolver
2. Enforce in-session dedupe
3. Novelty-biased randomness across sessions
4. Soft daily word/verb integration

## Phase 4 — UX + Telemetry
1. Dashboard shows `A1.07` style position
2. Readiness meter to next micro-level
3. Telemetry:
   - repetition rate
   - daily focus hit rate
   - module completion/accuracy by level

## Current Status
- Bootstrapped scripts + first master dataset generation from current approved vocabulary.
- Next: replace bootstrap source with full CEFR A1/A2 master corpus (~1500 words).
