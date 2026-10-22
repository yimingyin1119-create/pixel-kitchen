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

test('chef saves a signature dish', () => {
  const chef = setupChef();
  const r = call(chef.state, 'recipes.save', { recipe }, chef.token);
  assert.equal(r.status, 200);
  assert.equal(r.state.recipes[0].zone, 'signature');
});

test('diner can only create wish', () => {
  const diner = addDiner(setupChef());
  const r = call(diner.state, 'recipes.save', { recipe: { ...recipe, zone: 'signature' } }, diner.token);
  assert.equal(r.state.recipes[0].zone, 'wish');
  const uid = r.state.recipes[0].uid;
  assert.equal(call(r.state, 'recipes.save', { recipe: { ...recipe, uid, name: '改名' } }, diner.token).status, 403);
});

test('recipe needs a name', () => {
  const chef = setupChef();
  assert.equal(call(chef.state, 'recipes.save', { recipe: { ...recipe, name: ' ' } }, chef.token).status, 400);
});

test('promote moves wish to signature', () => {
  const chef = setupChef();
  const saved = call(chef.state, 'recipes.save', { recipe: { ...recipe, zone: 'wish' } }, chef.token);
  const uid = saved.state.recipes[0].uid;
  assert.equal(call(saved.state, 'recipes.promote', { uid }, chef.token).state.recipes[0].zone, 'signature');
});

test('vote toggles', () => {
  const chef = setupChef();
  const diner = addDiner(chef);
  const saved = call(diner.state, 'recipes.save', { recipe }, diner.token);
  const uid = saved.state.recipes[0].uid;
  const once = call(saved.state, 'recipes.vote', { uid }, chef.token);
  assert.deepEqual(once.state.recipes[0].wishVotes, [chef.uid]);
  assert.deepEqual(call(once.state, 'recipes.vote', { uid }, chef.token).state.recipes[0].wishVotes, []);
});

test('archived recipes leave the view', () => {
  const chef = setupChef();
  const saved = call(chef.state, 'recipes.save', { recipe }, chef.token);
  const r = call(saved.state, 'recipes.archive', { uid: saved.state.recipes[0].uid }, chef.token);
  assert.deepEqual(r.body.data.recipes, []);
});
