import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const root = process.cwd();
const url = 'https://raw.githubusercontent.com/choe220/1000-spanish-words/main/assets/words_updated.json';
const outPath = path.join(root, 'src/content/external/spanish-1000-seed.json');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const raw = await get(url);
const parsed = JSON.parse(raw);
const words = Array.isArray(parsed?.words) ? parsed.words : [];

const cleaned = [];
const seen = new Set();
for (const row of words) {
  const es = String(row?.spanish || '').trim();
  let en = String(row?.english || '').trim();
  const pos = String(row?.part_of_speech || 'general').trim().toLowerCase();
  if (!es) continue;
  en = en.replace(/\s+/g, ' ').trim();
  if (!en || en.length < 2) en = es;
  const esKey = es.toLowerCase();
  if (seen.has(esKey)) continue;
  seen.add(esKey);
  cleaned.push({ es, en, topic: pos });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ source: url, words: cleaned }, null, 2));
console.log(`Seed saved: ${cleaned.length} words -> ${outPath}`);
