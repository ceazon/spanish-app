/**
 * build-cefr-corpus.mjs
 *
 * Reads scripts/cefr-source-words.json (raw Spanish words + CEFR level)
 * and enriches each word via AI (English translation, POS, topic).
 * Outputs src/content/cefr-vocab.json — the single source of truth
 * for all vocabulary content in the app.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/build-cefr-corpus.mjs
 *
 * Options:
 *   --resume    Skip words already in the output file (safe to re-run)
 *   --dry-run   Print first batch prompt without calling the API
 *
 * The script writes progress after every batch so it can be safely
 * interrupted and resumed with --resume.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SOURCE_PATH  = path.join(__dirname, 'cefr-source-words.json');
const OUTPUT_PATH  = path.join(ROOT, 'src/content/cefr-vocab.json');
const BATCH_SIZE   = 30;
const DELAY_MS     = 1200; // stay well under rate limits

const args       = process.argv.slice(2);
const RESUME     = args.includes('--resume');
const DRY_RUN    = args.includes('--dry-run');
const API_KEY    = process.env.ANTHROPIC_API_KEY;

// Constants declared early to avoid TDZ errors when referenced in functions
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const VALID_POS  = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'phrase',
  'interjection', 'pronoun', 'preposition', 'conjunction', 'numeral', 'other',
]);

if (!API_KEY && !DRY_RUN) {
  console.error('Error: ANTHROPIC_API_KEY env var is required.');
  console.error('Usage: ANTHROPIC_API_KEY=sk-ant-... node scripts/build-cefr-corpus.mjs');
  process.exit(1);
}

// ── Load source words ────────────────────────────────────────────────────────

const sourceWords = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
console.log(`Loaded ${sourceWords.length} source words.`);

// ── Load existing output (for resume) ────────────────────────────────────────

let existingVocab = [];
let existingIds   = new Set();

if (RESUME && fs.existsSync(OUTPUT_PATH)) {
  const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  existingVocab  = existing.vocab || [];
  existingIds    = new Set(existingVocab.map(w => w.es.toLowerCase().trim()));
  console.log(`Resuming — ${existingVocab.length} words already processed, skipping those.`);
}

// ── Filter words to process ──────────────────────────────────────────────────

const toProcess = RESUME
  ? sourceWords.filter(w => !existingIds.has(w.es.toLowerCase().trim()))
  : sourceWords;

console.log(`Words to process: ${toProcess.length}`);

if (DRY_RUN) {
  const batch = toProcess.slice(0, BATCH_SIZE);
  console.log('\n── DRY RUN — First batch prompt ──────────────────────────────');
  console.log(buildPrompt(batch));
  process.exit(0);
}

// ── Process in batches ───────────────────────────────────────────────────────

const results = [...existingVocab];
let batchNum  = 0;
let errors    = 0;

for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
  const batch = toProcess.slice(i, i + BATCH_SIZE);
  batchNum++;

  const total     = Math.ceil(toProcess.length / BATCH_SIZE);
  const pct       = Math.round((i / toProcess.length) * 100);
  process.stdout.write(`[${batchNum}/${total}] (${pct}%) Processing "${batch[0].es}" … `);

  try {
    const enriched = await enrichBatch(batch);
    results.push(...enriched);
    process.stdout.write(`✓ ${enriched.length} words\n`);

    // Write after every batch (safe to interrupt + resume)
    writeOutput(results);
  } catch (err) {
    errors++;
    process.stdout.write(`✗ ERROR: ${err.message}\n`);
    console.error('  Skipping batch and continuing. Re-run with --resume to retry.');
  }

  if (i + BATCH_SIZE < toProcess.length) {
    await sleep(DELAY_MS);
  }
}

// ── Final summary ────────────────────────────────────────────────────────────

writeOutput(results);
console.log('\n── Complete ───────────────────────────────────────────────────');
console.log(`Total words: ${results.length}`);
console.log(`A1: ${results.filter(w => w.cefr === 'A1').length}`);
console.log(`A2: ${results.filter(w => w.cefr === 'A2').length}`);
if (errors) console.warn(`Batches with errors: ${errors} (re-run with --resume)`);
console.log(`Output: ${OUTPUT_PATH}`);

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPrompt(batch) {
  const list = batch.map((w, i) => `${i + 1}. ${w.es} [${w.cefr}]`).join('\n');

  return `You are a Spanish-English dictionary and CEFR classification expert.

For each Spanish word or phrase below, provide:
- "en": the best English translation (natural, most common meaning)
- "pos": part of speech — one of: noun, verb, adjective, adverb, phrase, interjection, pronoun, preposition, conjunction, numeral
- "topic": thematic category — one of: Greetings, Numbers, Time, Family, Body, Home, Food, Drink, Clothes, Animals, Transport, Weather, Places, Health, Work, Shopping, Travel, Technology, Entertainment, Education, Nature, Emotions, Society, Daily Routines, Communication, Verbs, Adjectives, Adverbs, Other

Respond with ONLY a valid JSON array in this exact format. No markdown, no explanation, no extra text:
[
  {"es":"hola","en":"hello","cefr":"A1","pos":"interjection","topic":"Greetings"},
  ...
]

Words to process:
${list}`;
}

async function enrichBatch(batch) {
  const prompt = buildPrompt(batch);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw  = data.content?.[0]?.text?.trim();

  if (!raw) throw new Error('Empty response from API');

  // Strip any accidental markdown code fences
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}\nRaw: ${raw.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed)) throw new Error('Expected JSON array from API');

  // Validate and normalise each entry
  return parsed
    .map((entry, idx) => {
      const source = batch[idx] || batch[batch.length - 1];
      return {
        id:    slugify(entry.es || source.es),
        es:    (entry.es    || source.es).trim(),
        en:    (entry.en    || '').trim(),
        cefr:  validateCefr(entry.cefr  || source.cefr),
        pos:   validatePos(entry.pos    || 'other'),
        topic: (entry.topic || 'Other').trim(),
      };
    })
    .filter(e => e.es && e.en); // drop any blanks
}

function writeOutput(vocab) {
  const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  for (const w of vocab) counts[w.cefr] = (counts[w.cefr] || 0) + 1;

  const out = {
    version:     1,
    generatedAt: new Date().toISOString(),
    counts,
    total:       vocab.length,
    vocab,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n');
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateCefr(val) {
  const v = String(val || '').toUpperCase().trim();
  return VALID_CEFR.has(v) ? v : 'A1';
}

function validatePos(val) {
  const v = String(val || '').toLowerCase().trim();
  return VALID_POS.has(v) ? v : 'other';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
