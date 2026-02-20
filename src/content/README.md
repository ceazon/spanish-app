# Content Packs

Phase 1 starter content-pack support.

## Active pack loading order
1. `window.storage` key: `contentPack:active` (JSON string)
2. fallback: `packs/starter-pack.json`

## Minimal schema

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "version": 1,
  "vocab": {
    "Category Name": [{ "en": "Hello", "es": "Hola" }]
  },
  "sentences": [
    { "template": "Yo ___ feliz.", "answer": "estoy", "hint": "I ___ happy." }
  ]
}
```

Currently used by:
- Flashcards / Word Match / Fill in the Blank
- Learn Verbs / Speed Round / Sentence Scramble
- Transcription / Audio Shadowing / Pronunciation Coach
- Scenario Builder / Chat Partner
- Image Labeling / Picture Description
- Placement Test
