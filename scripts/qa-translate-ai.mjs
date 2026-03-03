import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY missing');
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

async function geminiTranslateBatch(items, kind = 'word') {
  const instruction = kind === 'verb'
    ? 'Return a concise infinitive meaning like "to walk".'
    : 'Return the most common concise English translation.';

  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text:
`You are a Spanish->English lexicon validator for a learning app.
For each item, output corrected English translation.
${instruction}
Keep JSON only.
Schema: {"results":[{"id":"...","en":"..."}]}
Items:
${JSON.stringify(items)}` }],
    }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(txt);
  return Array.isArray(parsed?.results) ? parsed.results : [];
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cleanEn(v='') {
  return String(v).replace(/\s+/g, ' ').trim();
}

async function translateCollection(items, kind) {
  const work = items.map((x) => ({ id: x.id, es: x.es, en: x.en }));
  const byId = new Map();
  for (const batch of chunks(work, 40)) {
    let results = [];
    for (let t = 0; t < 3; t++) {
      try {
        results = await geminiTranslateBatch(batch, kind);
        break;
      } catch (e) {
        if (t === 2) throw e;
      }
    }
    for (const r of results) {
      if (!r?.id) continue;
      const en = cleanEn(r.en);
      if (en) byId.set(r.id, en);
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return byId;
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

const masterPath = path.join(root, 'src/content/cefr-vocab-master.json');
const dailyWordsPath = path.join(root, 'src/content/daily-focus-words.json');
const dailyVerbsPath = path.join(root, 'src/content/daily-focus-verbs.json');

const master = loadJson(masterPath);
const dailyWords = loadJson(dailyWordsPath);
const dailyVerbs = loadJson(dailyVerbsPath);

console.log('Translating master words:', master.words.length);
const masterMap = await translateCollection(
  master.words.map((w, i) => ({ id: `m:${i}`, es: w.es, en: w.en })),
  'word'
);
master.words = master.words.map((w, i) => ({ ...w, en: masterMap.get(`m:${i}`) || w.en }));

console.log('Translating daily words:', dailyWords.words.length);
const dwMap = await translateCollection(
  dailyWords.words.map((w, i) => ({ id: `dw:${i}`, es: w.es, en: w.en })),
  'word'
);
dailyWords.words = dailyWords.words.map((w, i) => ({ ...w, en: dwMap.get(`dw:${i}`) || w.en }));

console.log('Translating daily verbs:', dailyVerbs.verbs.length);
const verbMap = await translateCollection(
  dailyVerbs.verbs.map((v, i) => ({ id: `v:${i}`, es: v.infinitive, en: v.meaning })),
  'verb'
);
dailyVerbs.verbs = dailyVerbs.verbs.map((v, i) => {
  const meaning = verbMap.get(`v:${i}`) || v.meaning;
  const conjugations = (v.conjugations || []).map((c) => ({ ...c, meaning: `${c.pronoun} ${meaning}` }));
  return { ...v, meaning, conjugations };
});

saveJson(masterPath, master);
saveJson(dailyWordsPath, dailyWords);
saveJson(dailyVerbsPath, dailyVerbs);

console.log('AI translation QA pass complete');
