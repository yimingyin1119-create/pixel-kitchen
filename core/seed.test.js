import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedRows } from './seed.js';
import { deserialize } from './schema.js';

const recipes = JSON.parse(readFileSync(new URL('../seed/recipes.json', import.meta.url), 'utf8'));
const ctx = { now: '2026-10-23T00:00:00.000Z', rand: 'ab'.repeat(32), seq: 0 };

test('seed has 12 dishes with base 2', () => {
  assert.equal(recipes.length, 12);
  for (const r of recipes) {
    assert.equal(r.baseServings, 2, r.name);
    assert.ok(r.steps.length >= 3, r.name);
  }
});

test('seedRows serializes ingredients', () => {
  const rows = seedRows(ctx, recipes);
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((r) => r.uid)).size, 12);
  assert.equal(typeof rows[0].ingredients, 'string');
  const pork = deserialize('pk_recipes', rows.find((r) => r.name === '红烧肉'));
  assert.deepEqual(pork.ingredients[0], { name: '五花肉', qty: 500, unit: 'g', kind: 'main', inventoryUid: null });
  assert.equal(pork.createdBy, '');
  assert.equal(pork.zone, 'signature');
});
