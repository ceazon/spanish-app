# User Profile Schema Migration Plan (Phase 2)

## 1. Schema Expansion
The current `defaultLearningState` and `migrateUser` functions in `Spanish-app/src/services/progression.js` already contain several of the Phase 2 requirements (`cefrBand`, `microLevel`, `wordExposure`, `skillMastery`, `xp`). 

**Remaining Fields to Add:**
- `vocabularySize`: Estimated total words known.
- `lastLevelUpAt`: Timestamp for analytics.
- `streakMastery`: Level of consistency in the current band.

## 2. Gate Implementation
Enhance `computeMicroLevelGateStatus` to include the specific Phase 2 thresholds:
- **Coverage Gate:** `seenUnique / levelTotal >= 0.8`
- **Mastery Gate:** `masteredUnique / levelTotal >= 0.7`
- **Skill-Balance Gate:** `min(skillMastery) >= 40` (to ensure they aren't just doing Flashcards).

## 3. UI Integration
- Update Dashboard to show `A1.07` style text.
- Add "Readiness Meter" using the gate status.
- Add Celebration for sub-level ups.

## 4. Tasks
- [ ] Update `defaultLearningState` in `progression.js`.
- [ ] Implement enhanced gate logic in `updateLearningProfile`.
- [ ] Update `Dashboard` in `App.jsx` to reflect micro-level precision.
- [ ] Add sound/celebration trigger for micro-level completion.
