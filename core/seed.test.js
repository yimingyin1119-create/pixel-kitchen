import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedRows } from './seed.js';
import { deserialize } from './schema.js';

const recipes = JSON.parse(readFileSync(new URL('../seed/recipes.json', import.meta.url), 'utf8'));
const ctx = { now: '2026-10-23T00:00:00.000Z', rand: 'ab'.repeat(32), seq: 0 };

test('seed has 30 dishes with base 2, five of them desserts', () => {
  assert.equal(recipes.length, 30);
  assert.equal(new Set(recipes.map((r) => r.name)).size, 30);
  assert.equal(recipes.filter((r) => (r.tags ?? []).includes('甜品')).length, 5);
  for (const r of recipes) {
    assert.equal(r.baseServings, 2, r.name);
    assert.ok(r.steps.length >= 3, r.name);
  }
});

test('seedRows serializes ingredients', () => {
  const rows = seedRows(ctx, recipes);
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map((r) => r.uid)).size, 30);
  assert.equal(typeof rows[0].ingredients, 'string');
  const pork = deserialize('pk_recipes', rows.find((r) => r.name === '红烧肉'));
  assert.deepEqual(pork.ingredients[0], { name: '五花肉', qty: 500, unit: 'g', kind: 'main', inventoryUid: null });
  assert.equal(pork.createdBy, '');
  assert.equal(pork.zone, 'signature');
});

test('seedRows only adds dishes that are not there yet, deleted ones included', () => {
  const existing = [{ name: '红烧肉', archived: false }, { name: ' 番茄炒蛋 ', archived: true }, { name: '红烧鱼', archived: false }];
  const rows = seedRows({ ...ctx, seq: 0 }, recipes, existing);
  assert.equal(rows.length, 28);
  assert.ok(!rows.some((r) => r.name === '红烧肉' || r.name === '番茄炒蛋'));
});
