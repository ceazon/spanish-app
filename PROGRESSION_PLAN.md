# Chadlingo Progression System — Build Plan

> Drafted: 2026-02-25
> Status: APPROVED — ready to build

---

## Vision

Replace the current static vocab + loose difficulty system with a fully dynamic, CEFR-backed progression engine. Every word has a level. Every user has a level. The app always serves the right content, celebrates every milestone, and makes the path forward feel clear and achievable.

Users never see "A1" or "CEFR" — they see titles like **Explorer**, **Storyteller**, **Fluent**. The language is theirs.

---

## Level Architecture

40 total levels across A1–B2 (10 sub-levels per CEFR band, every 10% = rank up).
B1/B2 follow the same structure — names TBD when we get there.

### A1 — "Foundations" (~600 words)

| Sub-level | % of A1 | Title              |
|-----------|---------|--------------------|
| 0         | 0–10%   | Newcomer           |
| 1         | 10–20%  | Beginner           |
| 2         | 20–30%  | Student            |
| 3         | 30–40%  | Explorer           |
| 4         | 40–50%  | Apprentice         |
| 5         | 50–60%  | Practitioner       |
| 6         | 60–70%  | Speaker            |
| 7         | 70–80%  | Conversationalist  |
| 8         | 80–90%  | Achiever           |
| 9         | 90–100% | Foundation Master  |

Completing Foundation Master (100% A1) → unlocks A2 + triggers Band Celebration.

### A2 — "Elementary" (~1,200 words)

| Sub-level | % of A2 | Title              |
|-----------|---------|--------------------|
| 0         | 0–10%   | Elementary         |
| 1         | 10–20%  | Traveller          |
| 2         | 20–30%  | Navigator          |
| 3         | 30–40%  | Communicator       |
| 4         | 40–50%  | Builder            |
| 5         | 50–60%  | Connector          |
| 6         | 60–70%  | Storyteller        |
| 7         | 70–80%  | Debater            |
| 8         | 80–90%  | Fluent             |
| 9         | 90–100% | Elementary Master  |

Completing Elementary Master (100% A2) → unlocks B1 + triggers Band Celebration.

### B1 / B2 — Hooks Only (names TBD)

The system is fully band-agnostic. Adding B1/B2 = adding words to the corpus + naming 20 more titles. No architectural changes.

### C1 / C2 — Enum Reserved

CEFR enum includes C1/C2 from day one. No content yet.

---

## Data Architecture

### 1. CEFR Corpus — `src/content/cefr-vocab.json`

Single source of truth for all vocabulary content. Replaces `approved-vocab-1000.json` and `canonical-vocab.json`.

```json
{
  "version": 1,
  "generatedAt": "2026-02-25",
  "vocab": [
    {
      "id": "hola",
      "es": "hola",
      "en": "hello",
      "cefr": "A1",
      "pos": "interjection",
      "topic": "Greetings",
      "frequency": 1
    }
  ]
}
```

Fields:
- `id` — slug key (lowercase es word, deduped)
- `es` — Spanish word
- `en` — English translation (AI-generated)
- `cefr` — "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
- `pos` — part of speech: "noun" | "verb" | "adjective" | "adverb" | "phrase" | "interjection"
- `topic` — thematic category (Greetings, Food, Travel, etc.)
- `frequency` — relative frequency rank within band (1 = most common)

### 2. User Profile Schema v3

Replaces existing profile entirely. Old data is wiped on schema migration.

```json
{
  "schemaVersion": 3,
  "cefrBand": "A1",
  "sublevel": 3,
  "bandProgress": 0.34,
  "bandStrength": 4.1,
  "wordExposure": {
    "hola":    { "seen": 6, "correct": 5, "lastSeen": "2026-02-25T14:00:00Z" },
    "gracias": { "seen": 3, "correct": 3, "lastSeen": "2026-02-24T10:00:00Z" }
  },
  "badges": ["first-word", "streak-3"],
  "streak": 4,
  "lastSessionDate": "2026-02-25",
  "totalWordsIntroduced": 145,
  "totalCorrect": 312,
  "totalAttempts": 380
}
```

### 3. Band Strength Formula

Displayed as a 1–10 score. Rewards both breadth (coverage) and accuracy.

```
coverage = words seen in band / total words in band
accuracy = correct answers in band / total attempts in band
bandStrength = round(coverage × accuracy × 10, 1)
```

Example: Seen 70% of A1, 85% accuracy → `0.7 × 0.85 × 10 = 5.95`

A user cannot inflate this by hammering 5 words — breadth is required.

### 4. Sub-level Calculation

```
sublevel = Math.floor(bandProgress × 10)   // 0–9
title    = TITLES[cefrBand][sublevel]
```

`bandProgress` = words seen in band / total words in band (coverage only — not accuracy).
This way users always feel forward momentum as they encounter new words, even before mastery.

---

## Content Resolver

`getWordsForSession(user, count)` — called by every vocab module.

| Bucket   | Share | Criteria |
|----------|-------|----------|
| Current  | 65%   | Current band — seen but correct rate < 80% |
| Review   | 15%   | Any band — seen, correct rate ≥ 80% (spaced rep) |
| Stretch  | 15%   | Next band — never seen (max 3–5 new words per session) |
| Weak     | 5%    | Any band — seen, correct rate < 40% |

Rules:
- Stretch capped at **5 new words per session** to avoid overwhelm
- Review words prioritized by longest time since last seen
- Weak words always included when they exist
- Falls back gracefully if a bucket is empty (redistributes share)

---

## AI Sentence Generation

Called once at **session start** for modules that need sentences.

Applies to: Fill in the Blank, Sentence Scramble, Learn Verbs.

```
Prompt template:
"Generate {n} Spanish sentences for a {title} level learner.
Use words from this pool where possible: [{wordList}].
Keep grammar at {cefrBand} level. Return JSON array:
[{ 'es': '...', 'en': '...', 'blank': 'word', 'hint': '...' }]"
```

- Sentences cached for the session (no per-exercise latency)
- Pool = user's current exposed words + a few new ones from corpus
- Grammar complexity matches CEFR band, not just vocabulary

---

## Gamification

### Badges (MVP Set)

| Badge | Trigger |
|-------|---------|
| 🎯 First Steps | First word answered correctly |
| 🔥 On a Roll | 3-day practice streak |
| 🔥 Week Warrior | 7-day practice streak |
| 🔥 Monthly Legend | 30-day practice streak |
| ⭐ Halfway There | 50% band progress at current level |
| ⚡ Sharp Mind | 10 correct answers in a row |
| 🌙 Night Owl | Practiced after 10pm |
| 🏆 Foundation Master | 100% A1 complete |
| 🚀 First Stretch | First A2 word encountered |
| 💎 Elementary Master | 100% A2 complete |

More badges added in future gamification pass.

### Celebration System

**Sub-level celebration** (fires every 10% within a band — 40 times total):
- Confetti burst animation (canvas-based, no library needed)
- Web Audio API chime/fanfare (no sound files required)
- New title card displayed front and center
- Progress bar animates to new position
- Badge awarded if milestone has one

**Band completion celebration** (fires at 100% band — 4 times total):
- Full-screen takeover
- Fireworks animation
- Orchestral/triumphant Web Audio fanfare (bigger than sub-level)
- Large badge displayed
- Summary card: words mastered, time at this level, accuracy
- "Share your achievement" button (text copy for now, native share API later)
- Dramatic transition to unlocked next band

---

## Dashboard Display

Everything uses descriptive labels — no A1/A2/CEFR shown to users.

```
┌─────────────────────────────────────────────────────┐
│  🌟 Explorer                         Level 4 of 40  │
│  ████████████░░░░░░░░  38% → Apprentice              │
│                                                     │
│  Foundations Strength: 4.1 / 10                     │
│  ████████░░░░░░░░░░░░                                │
│                                                     │
│  🔥 4-day streak  •  145 words  •  82% accuracy     │
│                                                     │
│  NEXT UP: Apprentice (12 more sessions est.)        │
└─────────────────────────────────────────────────────┘
```

Secondary section — Journey Map (collapsed by default):
- All 40 levels shown as a path
- Completed = filled, current = pulsing, locked = greyed
- Band names shown as chapter headings ("Foundations", "Elementary")

---

## Phase Build Plan

### Phase 1 — CEFR Corpus

**Goal:** Produce `src/content/cefr-vocab.json` — clean, validated, AI-translated A1+A2 corpus.

Tasks:
1. Research and compile Spanish A1+A2 master word list from open CEFR sources
2. Write `scripts/build-cefr-corpus.mjs` — ingests raw Spanish list, calls AI for English translation + POS + topic tagging, outputs `cefr-vocab.json`
3. Validate output: no duplicates, no identity translations, all fields present, counts correct (~600 A1, ~1200 A2)
4. Write `src/content/cefr-vocab.test.js` — automated validation tests

**Output:** `src/content/cefr-vocab.json` (~1,800 entries)

---

### Phase 2 — Progression Engine

**Goal:** New user profile schema + smart content resolver wired to all modules.

Tasks:
1. Define CEFR constants, title maps, band config in `src/config/cefr.js`
2. Rewrite `src/services/progression.js` — new schema v3, band strength calculator, sublevel calculator, word exposure updater
3. Write `src/services/contentResolver.js` — `getWordsForSession()`, `getSentencesForSession()` (AI call), smart bucket logic
4. Update placement test → maps to CEFR band + starting sublevel
5. Write schema migration in `src/services/storage.js` (v2 → v3 wipe + reset)
6. Wire all vocab modules (Flashcards, Word Match, Fill in the Blank, Sentence Scramble, Learn Verbs, Speed Round) to use `contentResolver` instead of static arrays
7. Update word exposure on every lesson completion → recalculate band strength + sublevel

**Output:** Fully functional progression engine. App serves dynamic content. No UI changes yet.

---

### Phase 3 — UI + Gamification

**Goal:** Dashboard, celebrations, badges, level-up moments.

Tasks:
1. Redesign dashboard to show: title, sublevel progress bar, band strength bar, streak, words mastered, accuracy, next milestone ETA
2. Build journey map component (all 40 levels as visual path)
3. Build badge system: `src/services/badges.js` — evaluates triggers after each session, stores earned badges
4. Build sub-level celebration component (confetti + Web Audio chime + title card)
5. Build band completion celebration component (full-screen fireworks + fanfare + summary)
6. Wire celebrations into lesson completion flow
7. Wire AI sentence generation into session start for relevant modules

**Output:** Full user-facing progression system. Feels polished, celebratory, motivating.

---

## Out of Scope (MVP)

- B1/B2 corpus content (architecture ready, content TBD)
- C1/C2 content
- Social sharing (hook in place)
- Leaderboards
- Expanded badge set
- Streak freeze / recovery
- Offline mode

---

## Migration Notes

- All existing user profiles wiped on first load after deploy (schema v2 → v3 triggers reset)
- Users start at placement test → assigned starting sublevel
- No existing vocab files carried forward — `cefr-vocab.json` is the new source of truth
- `approved-vocab-1000.json` and `canonical-vocab.json` kept in repo for reference but no longer imported

---

## Open Questions (Resolved)

- CEFR scope: A1+A2 now, B1/B2 later, C1/C2 hooks ✅
- Corpus source: Spanish CEFR lists + AI translation ✅
- Strength model: Per-word internal, band-level display ✅
- Soft gates: Yes — stretch words, no hard locks ✅
- Sentence source: AI-generated at session start ✅
- New word introduction rate: 3–5 per session ✅
- Celebration type: Sub-level burst + band full-screen ✅
- Sounds: Web Audio API (no external files) ✅
- Existing user data: Wiped clean ✅
- Level labels: Descriptive titles, no CEFR shown to users ✅
