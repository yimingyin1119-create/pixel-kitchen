import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchIngredient, normalizeDraft } from './recipes.js';
import { call, setupChef, addDiner } from './testkit.js';

const inventory = [
  { uid: 'i1', name: '番茄', aliases: ['西红柿'], kind: 'main', qty: 300, unit: 'g' },
  { uid: 'i2', name: '五花肉', aliases: [], kind: 'main', qty: 800, unit: 'g' },
];

test('match by alias', () => assert.equal(matchIngredient('西红柿', inventory).uid, 'i1'));
test('match ignores modifiers', () => assert.equal(matchIngredient('新鲜五花肉', inventory).uid, 'i2'));
test('no match returns null', () => assert.equal(matchIngredient('小葱', inventory), null));

test('normalizeDraft converts 1斤 to 500 g when stock in g', () => {
  const d = normalizeDraft({ name: '红烧肉', baseServings: 2, ingredients: [{ name: '五花肉', qty: 1, unit: '斤', kind: 'main' }] }, inventory);
  assert.deepEqual(d.ingredients[0], { name: '五花肉', qty: 500, unit: 'g', kind: 'main', inventoryUid: 'i2', unmatched: false });
});

test('normalizeDraft keeps 适量 as null and marks unmatched', () => {
  const d = normalizeDraft({ name: '炒青菜', ingredients: [{ name: '盐', qty: null, unit: '适量', kind: 'seasoning' }] }, inventory);
  assert.equal(d.ingredients[0].qty, null);
  assert.equal(d.ingredients[0].unmatched, true);
  assert.equal(d.baseServings, 2);
});

test('normalizeDraft treats zero quantity as 适量', () => {
  const d = normalizeDraft({ name: 'x', ingredients: [{ name: '番茄', qty: 0, unit: '个', kind: 'main' }] }, inventory);
  assert.equal(d.ingredients[0].qty, null);
});

const recipe = { name: '番茄炒蛋', baseServings: 2, ingredients: [{ name: '番茄', qty: 2, unit: '个', kind: 'main' }], steps: ['切', '炒'] };

test('any member saves a dish', () => {
  const a = setupChef();
  const b = addDiner(a);
  const r = call(b.state, 'recipes.save', { recipe }, b.token);
  assert.equal(r.status, 200);
  assert.equal(r.state.recipes[0].name, '番茄炒蛋');
});

test('any member can edit any dish', () => {
  const a = setupChef();
  const b = addDiner(a);
  const saved = call(b.state, 'recipes.save', { recipe }, a.token);
  const uid = saved.state.recipes[0].uid;
  const r = call(saved.state, 'recipes.save', { recipe: { ...recipe, uid, baseServings: 3 } }, b.token);
  assert.equal(r.state.recipes[0].baseServings, 3);
});

test('recipe needs a name', () => {
  const chef = setupChef();
  assert.equal(call(chef.state, 'recipes.save', { recipe: { ...recipe, name: ' ' } }, chef.token).status, 400);
});

test('duplicate names ignore spaces and case', () => {
  const a = setupChef();
  let s = call(a.state, 'recipes.save', { recipe }, a.token).state;
  const dup = call(s, 'recipes.save', { recipe: { ...recipe, name: ' 番茄炒蛋 ' } }, a.token);
  assert.equal(dup.status, 409);
  assert.match(dup.body.error.message, /已经有「番茄炒蛋」了/);
  s = call(s, 'recipes.save', { recipe: { ...recipe, name: 'Tofu' } }, a.token).state;
  assert.equal(call(s, 'recipes.save', { recipe: { ...recipe, name: 'tofu' } }, a.token).status, 409);
});

test('archived name can be reused', () => {
  const a = setupChef();
  let s = call(a.state, 'recipes.save', { recipe }, a.token).state;
  s = call(s, 'recipes.archive', { uid: s.recipes[0].uid }, a.token).state;
  assert.equal(call(s, 'recipes.save', { recipe }, a.token).status, 200);
});

test('any member can archive a recipe', () => {
  const a = setupChef();
  const b = addDiner(a);
  const saved = call(b.state, 'recipes.save', { recipe }, a.token);
  const r = call(saved.state, 'recipes.archive', { uid: saved.state.recipes[0].uid }, b.token);
  assert.deepEqual(r.body.data.recipes, []);
});

test('wish-list actions are gone', () => {
  const a = setupChef();
  assert.equal(call(a.state, 'recipes.promote', { uid: 'x' }, a.token).status, 400);
  assert.equal(call(a.state, 'recipes.vote', { uid: 'x' }, a.token).status, 400);
});
