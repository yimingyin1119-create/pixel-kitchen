import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNeeds } from './orders.js';
import { call, setupChef, addDiner } from './testkit.js';

const PORK_DISH = {
  name: '红烧肉', baseServings: 2,
  ingredients: [
    { name: '五花肉', qty: 500, unit: 'g', kind: 'main' },
    { name: '酱油', qty: null, unit: '适量', kind: 'seasoning' },
  ],
};
const TOMATO_DISH = { name: '番茄炒蛋', baseServings: 2, ingredients: [{ name: '番茄', qty: 2, unit: '个', kind: 'main' }] };

// Chef + diner (both with push tokens), stock and two signature dishes.
function kitchen({ porkQty = 800, lowThreshold = 100, extraStock = [] } = {}) {
  const chef = setupChef();
  let s = call(chef.state, 'me.update', { pushToken: 'tok-chef' }, chef.token).state;
  const items = [
    { name: '五花肉', kind: 'main', qty: porkQty, unit: 'g', lowThreshold },
    { name: '番茄', kind: 'main', qty: 300, unit: 'g', lowThreshold: 0 },
    ...extraStock,
  ];
  for (const item of items) s = call(s, 'inventory.save', { item }, chef.token).state;
  for (const recipe of [PORK_DISH, TOMATO_DISH]) s = call(s, 'recipes.save', { recipe }, chef.token).state;
  const diner = addDiner({ state: s, token: chef.token });
  s = call(diner.state, 'me.update', { pushToken: 'tok-diner' }, diner.token).state;
  const dish = (name) => s.recipes.find((r) => r.name === name).uid;
  return { s, chef, diner, pork: dish('红烧肉'), tomato: dish('番茄炒蛋') };
}

const when = { wantedDate: '2026-10-22', meal: 'dinner', wantedTime: '19:00', note: '少辣' };

function place(k, items, servings = 3, state = k.s, token = k.diner.token) {
  return call(state, 'orders.place', { items, servings, ...when }, token);
}

test('scale needs by servings', () => {
  const k = kitchen();
  const needs = computeNeeds([k.s.recipes.find((r) => r.uid === k.pork)], 3, k.s.inventory);
  assert.equal(needs.find((n) => n.name === '五花肉').qty, 750);
});

test('shortage goes to shopping', () => {
  const k = kitchen({ porkQty: 200 });
  const r = place(k, [k.pork]);
  assert.equal(r.status, 200);
  const order = r.state.orders[0];
  assert.deepEqual(order.shortages.map((x) => [x.name, x.qty, x.reason]), [['五花肉', 550, 'short']]);
  assert.equal(r.state.shopping[0].qty, 550);
  assert.equal(r.state.shopping[0].reasons[0].orderUid, order.uid);
});

test('unit mismatch is flagged not deducted', () => {
  const k = kitchen();
  let r = place(k, [k.tomato]);
  const order = r.state.orders[0];
  assert.equal(order.shortages[0].reason, 'unitMismatch');
  assert.equal(r.state.shopping.length, 0);
  r = call(r.state, 'orders.accept', { uid: order.uid }, k.chef.token);
  r = call(r.state, 'orders.done', { uid: order.uid }, k.chef.token);
  assert.equal(r.state.inventory.find((i) => i.name === '番茄').qty, 300);
});

test('place rejects wish recipe', () => {
  const k = kitchen();
  const wish = call(k.s, 'recipes.save', { recipe: { name: '佛跳墙', ingredients: [] } }, k.diner.token);
  const uid = wish.state.recipes.find((r) => r.name === '佛跳墙').uid;
  assert.equal(place(k, [uid], 2, wish.state).status, 400);
});

test('place rejects past date and bad meal', () => {
  const k = kitchen();
  const base = { items: [k.pork], servings: 2, wantedTime: '' };
  assert.equal(call(k.s, 'orders.place', { ...base, wantedDate: '2026-10-21', meal: 'dinner' }, k.diner.token).status, 400);
  assert.equal(call(k.s, 'orders.place', { ...base, wantedDate: '2026-10-22', meal: 'brunch' }, k.diner.token).status, 400);
  assert.equal(call(k.s, 'orders.place', { ...base, wantedDate: '2026-10-22', meal: 'late', wantedTime: '25:00' }, k.diner.token).status, 400);
});

test('servings must be 1 to 20', () => {
  const k = kitchen();
  assert.equal(place(k, [k.pork], 0).status, 400);
  assert.equal(place(k, [k.pork], 21).status, 400);
});

test('placed event to chef', () => {
  const k = kitchen({ porkQty: 200 });
  const e = place(k, [k.pork]).events[0];
  assert.equal(e.type, 'order.placed');
  assert.equal(e.to, 'tok-chef');
  assert.deepEqual(e.dishes, ['红烧肉']);
  assert.equal(e.servings, 3);
  assert.equal(e.who, '小明');
  assert.deepEqual(e.shortages, ['五花肉']);
});

test('cancel unwinds shopping', () => {
  const k = kitchen({ porkQty: 200 });
  let r = place(k, [k.pork]);
  r = call(r.state, 'orders.cancel', { uid: r.state.orders[0].uid }, k.diner.token);
  assert.equal(r.state.orders[0].status, 'cancelled');
  assert.equal(r.state.shopping[0].removed, true);
});

test('reject keeps other reasons', () => {
  const k = kitchen({ porkQty: 200 });
  let r = call(k.s, 'shopping.add', { name: '五花肉', qty: 100, unit: 'g' }, k.chef.token);
  r = place(k, [k.pork], 3, r.state);
  assert.equal(r.state.shopping[0].qty, 650);
  r = call(r.state, 'orders.reject', { uid: r.state.orders[0].uid, reason: '缺料' }, k.chef.token);
  assert.equal(r.state.shopping[0].qty, 100);
  assert.equal(r.state.shopping[0].removed, false);
  assert.deepEqual(r.events[0], { type: 'order.rejected', to: 'tok-diner', dishes: ['红烧肉'], reason: '缺料' });
});

test('reject needs a reason', () => {
  const k = kitchen();
  const r = place(k, [k.pork]);
  assert.equal(call(r.state, 'orders.reject', { uid: r.state.orders[0].uid, reason: ' ' }, k.chef.token).status, 400);
});

test('done deducts and emits stock.low', () => {
  const k = kitchen({ porkQty: 800, lowThreshold: 100 });
  let r = place(k, [k.pork]);
  const uid = r.state.orders[0].uid;
  r = call(r.state, 'orders.accept', { uid }, k.chef.token);
  assert.deepEqual(r.events, [{ type: 'order.accepted', to: 'tok-diner', dishes: ['红烧肉'] }]);
  r = call(r.state, 'orders.done', { uid }, k.chef.token);
  assert.equal(r.state.inventory.find((i) => i.name === '五花肉').qty, 50);
  assert.equal(r.state.shopping[0].reasons[0].type, 'low');
  assert.deepEqual(r.events.map((e) => e.type).sort(), ['order.done', 'stock.low']);
  assert.equal(r.events.find((e) => e.type === 'stock.low').to, 'tok-chef');
});

test('done is idempotent', () => {
  const k = kitchen();
  let r = place(k, [k.pork]);
  const uid = r.state.orders[0].uid;
  r = call(r.state, 'orders.accept', { uid }, k.chef.token);
  r = call(r.state, 'orders.done', { uid }, k.chef.token);
  const again = call(r.state, 'orders.done', { uid }, k.chef.token);
  assert.equal(again.status, 409);
  assert.equal(again.state.inventory.find((i) => i.name === '五花肉').qty, 50);
});

test('accept cancelled order conflicts', () => {
  const k = kitchen();
  let r = place(k, [k.pork]);
  const uid = r.state.orders[0].uid;
  r = call(r.state, 'orders.cancel', { uid }, k.diner.token);
  assert.equal(call(r.state, 'orders.accept', { uid }, k.chef.token).status, 409);
});

test('only owner cancels pending', () => {
  const k = kitchen();
  let r = place(k, [k.pork]);
  const uid = r.state.orders[0].uid;
  const other = addDiner({ state: r.state, token: k.chef.token }, '小红', '1111');
  assert.equal(call(other.state, 'orders.cancel', { uid }, other.token).status, 403);
  r = call(r.state, 'orders.accept', { uid }, k.chef.token);
  assert.equal(call(r.state, 'orders.cancel', { uid }, k.diner.token).status, 409);
});

test('no event when no push token', () => {
  const k = kitchen();
  const s = call(k.s, 'me.update', { pushToken: '' }, k.chef.token).state;
  const r = place(k, [k.pork], 3, s);
  assert.equal(r.status, 200);
  assert.deepEqual(r.events, []);
});

test('availability lists missing names', () => {
  const k = kitchen();
  const withScallion = call(k.s, 'recipes.save', {
    recipe: { name: '葱油拌面', ingredients: [{ name: '小葱', qty: 2, unit: '根', kind: 'main' }] },
  }, k.chef.token);
  const v = call(withScallion.state, 'state.get', {}, k.diner.token).body.data;
  const uid = withScallion.state.recipes.find((r) => r.name === '葱油拌面').uid;
  assert.deepEqual(v.availability[uid], { makeable: false, missing: ['小葱'] });
  assert.equal(v.availability[k.pork].makeable, true);
});

test('dishCounts only done', () => {
  const k = kitchen();
  let r = place(k, [k.pork, k.tomato]);
  const uid = r.state.orders[0].uid;
  r = place(k, [k.pork], 2, r.state);
  r = call(r.state, 'orders.accept', { uid }, k.chef.token);
  r = call(r.state, 'orders.done', { uid }, k.chef.token);
  assert.deepEqual(r.body.data.dishCounts, { [k.pork]: 1, [k.tomato]: 1 });
});
