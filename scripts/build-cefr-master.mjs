import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const approvedPath = path.join(root, 'src/content/approved-vocab-1000.json');
const outPath = path.join(root, 'src/content/cefr-vocab-master.json');

const approved = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
const vocab = approved?.vocab || {};

const rows = [];
for (const [topic, items] of Object.entries(vocab)) {
  for (const item of items || []) {
    if (!item?.es || !item?.en) continue;
    const difficulty = Number(item?.difficulty || 1);
    const cefr = difficulty <= 1 ? 'A1' : 'A2';
    rows.push({
      es: item.es,
      en: item.en,
      topic,
      cefr,
    });
  }
}

const dedup = [];
const seen = new Set();
for (const r of rows) {
  const key = String(r.es).toLowerCase().trim();
  if (seen.has(key)) continue;
  seen.add(key);
  dedup.push(r);
}

const byBand = {
  A1: dedup.filter((w) => w.cefr === 'A1'),
  A2: dedup.filter((w) => w.cefr === 'A2'),
};

function withMicroLevels(list, band) {
  return list.map((w, idx) => {
    const denom = Math.max(1, list.length);
    const microLevel = Math.max(1, Math.min(20, Math.floor((idx / denom) * 20) + 1));
    return {
      id: `${band}.${String(microLevel).padStart(2, '0')}:${String(w.es).toLowerCase().replace(/\s+/g, '-')}`,
      es: w.es,
      en: w.en,
      cefr: band,
      microLevel,
      topic: w.topic,
      frequencyRank: idx + 1,
    };
  });
}

const out = {
  generatedAt: new Date().toISOString(),
  words: [
    ...withMicroLevels(byBand.A1, 'A1'),
    ...withMicroLevels(byBand.A2, 'A2'),
  ],
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

const counts = out.words.reduce((acc, w) => {
  acc[w.cefr] = (acc[w.cefr] || 0) + 1;
  return acc;
}, {});

console.log('Built cefr-vocab-master.json', counts, 'total=', out.words.length);
