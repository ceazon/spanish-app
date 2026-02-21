import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const canonicalPath = path.resolve(process.cwd(), 'src/content/approved-vocab-1000.json');
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

function norm(s = '') {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

test('canonical vocab entries are approved and not identity translations', () => {
  const allowedIdentity = new Set(['no','banana','mango','taxi','hotel','internet','hospital']);
  for (const [category, items] of Object.entries(canonical.vocab || {})) {
    for (const item of items || []) {
      assert.equal(item.approved, true, `${category} -> ${item.en} must be approved`);
      assert.ok(item.en && item.es, `${category} has missing en/es`);
      const same = norm(item.en) === norm(item.es);
      if (same) {
        assert.ok(allowedIdentity.has(norm(item.en)), `${category} invalid identity translation: ${item.en} -> ${item.es}`);
      }
    }
  }
});

test('approved deck has substantial seeded volume', () => {
  let count = 0;
  for (const items of Object.values(canonical.vocab || {})) count += (items || []).length;
  assert.ok(count >= 200, `approved deck too small: ${count}`);
});

test('critical starter translations are correct', () => {
  const index = new Map();
  for (const [category, items] of Object.entries(canonical.vocab || {})) {
    for (const item of items || []) index.set(`${category}::${item.en}`, item.es);
  }

  assert.equal(index.get('Greetings::Hello'), 'Hola');
  assert.equal(index.get('Greetings::Goodbye'), 'Adiós');
  assert.equal(index.get('Greetings::Thank you'), 'Gracias');
  assert.equal(index.get('Greetings::Please'), 'Por favor');
  assert.equal(index.get('Food::Chicken'), 'Pollo');
  assert.equal(index.get('Greetings::Good night'), 'Buenas noches');
});
