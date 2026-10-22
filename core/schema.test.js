import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, serialize, deserialize, stateFromTables } from './schema.js';

test('every table has a uid column', () => {
  for (const cols of Object.values(TABLES)) assert.equal(cols.uid, 'string');
});

test('serialize stringifies json columns and drops unknown keys', () => {
  const raw = serialize('pk_recipes', { uid: 'r1', name: '红烧肉', ingredients: [{ name: '五花肉', qty: 500, unit: 'g' }], junk: 1 });
  assert.equal(typeof raw.ingredients, 'string');
  assert.ok(!('junk' in raw));
  assert.equal(raw.baseServings, 0);
  assert.equal(raw.archived, false);
});

test('deserialize drops system columns and parses json', () => {
  const raw = serialize('pk_recipes', { uid: 'r1', ingredients: [{ name: '五花肉', qty: 500, unit: 'g' }] });
  const row = deserialize('pk_recipes', { ...raw, id: 7, createdAt: 'x', updatedAt: 'y' });
  assert.equal(row.ingredients[0].qty, 500);
  assert.ok(!('id' in row) && !('createdAt' in row));
});

test('deserialize returns null without uid', () => assert.equal(deserialize('pk_users', {}), null));

test('bad json becomes empty array', () =>
  assert.deepEqual(deserialize('pk_recipes', { uid: 'r1', steps: '{oops' }).steps, []));

test('stateFromTables builds named arrays and skips empty rows', () => {
  const s = stateFromTables({ pk_users: [{ uid: 'u1', name: 'A' }, {}] });
  assert.equal(s.users.length, 1);
  assert.deepEqual(s.orders, []);
});
