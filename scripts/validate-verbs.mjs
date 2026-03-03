import fs from 'node:fs';
import path from 'node:path';

const p = path.join(process.cwd(), 'src/content/daily-focus-verbs.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
const verbs = Array.isArray(data?.verbs) ? data.verbs : [];

const requiredPronouns = ['yo', 'tú', 'él / ella', 'nosotros', 'vosotros', 'ellos / ellas'];
const errors = [];

for (const [i, v] of verbs.entries()) {
  const loc = `verbs[${i}](${v?.infinitive || 'unknown'})`;
  if (!v?.infinitive) errors.push(`${loc}: missing infinitive`);
  if (!v?.meaning || !String(v.meaning).toLowerCase().startsWith('to ')) errors.push(`${loc}: meaning should start with "to "`);

  const conj = Array.isArray(v?.conjugations) ? v.conjugations : [];
  const pronouns = new Set(conj.map((c) => c?.pronoun));
  for (const p of requiredPronouns) {
    if (!pronouns.has(p)) errors.push(`${loc}: missing conjugation for ${p}`);
  }
  for (const c of conj) {
    if (!c?.form || !String(c.form).trim()) errors.push(`${loc}: empty conjugation form for ${c?.pronoun || 'unknown'}`);
  }
}

if (errors.length) {
  console.error(`Verb validation failed: ${errors.length} issue(s)`);
  for (const e of errors.slice(0, 120)) console.error('-', e);
  process.exit(1);
}

console.log(`Verb validation OK (${verbs.length} verbs)`);
