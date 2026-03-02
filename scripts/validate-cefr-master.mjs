import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const target = path.join(root, 'src/content/cefr-vocab-master.json');

const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const words = Array.isArray(data?.words) ? data.words : [];

const errors = [];
const ids = new Set();
const esSeen = new Set();

for (const [i, w] of words.entries()) {
  const loc = `words[${i}]`;
  if (!w?.id) errors.push(`${loc}: missing id`);
  if (!w?.es) errors.push(`${loc}: missing es`);
  if (!w?.en) errors.push(`${loc}: missing en`);
  if (!w?.cefr || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(w.cefr)) errors.push(`${loc}: invalid cefr`);
  if (!Number.isFinite(Number(w?.microLevel)) || Number(w.microLevel) < 1 || Number(w.microLevel) > 20) errors.push(`${loc}: invalid microLevel`);

  if (w?.id) {
    if (ids.has(w.id)) errors.push(`${loc}: duplicate id ${w.id}`);
    ids.add(w.id);
  }

  const esKey = String(w?.es || '').toLowerCase().trim();
  if (esKey) {
    if (esSeen.has(esKey)) errors.push(`${loc}: duplicate es ${w.es}`);
    esSeen.add(esKey);
  }
}

if (errors.length) {
  console.error(`Validation failed (${errors.length}):`);
  for (const e of errors.slice(0, 100)) console.error('-', e);
  process.exit(1);
}

const byBand = words.reduce((acc, w) => {
  acc[w.cefr] = (acc[w.cefr] || 0) + 1;
  return acc;
}, {});

console.log('Validation OK', { total: words.length, byBand });
