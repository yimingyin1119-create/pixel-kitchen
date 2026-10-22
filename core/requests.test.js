import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNeeds } from './requests.js';
import { call, emptyState, register } from './testkit.js';

const recipe = (uid, name, ingredients) => ({
  uid, name, zone: 'signature', imageUrl: '', sourceUrl: '', baseServings: 2, ingredients, steps: [], tags: [],
  wishVotes: [], createdBy: '', createdIso: '', archived: false,
});
const PORK = recipe('r_pork', '红烧肉', [
  { name: '五花肉', qty: 500, unit: 'g', kind: 'main', inventoryUid: null },
  { name: '酱油', qty: null, unit: '适量', kind: 'seasoning', inventoryUid: null },
]);
const TOMATO = recipe('r_tomato', '番茄炒蛋', [{ name: '番茄', qty: 2, unit: '个', kind: 'main', inventoryUid: null }]);

// Two members (A=小明, B=小红) with push tokens, some stock, two dishes.
function kitchen({ porkQty = 800, lowThreshold = 100 } = {}) {
  const a = register(emptyState(), '小明', '1111');
  const b = register(a.state, '小红', '2222');
  let s = call(b.state, 'me.update', { pushToken: 'tok-a' }, a.token).state;
  s = call(s, 'me.update', { pushToken: 'tok-b' }, b.token).state;
  for (const item of [
    { name: '五花肉', kind: 'main', qty: porkQty, unit: 'g', lowThreshold },
    { name: '番茄', kind: 'main', qty: 300, unit: 'g', lowThreshold: 0 },
  ]) s = call(s, 'inventory.save', { item }, a.token).state;
  return { s: { ...s, recipes: [PORK, TOMATO] }, a, b };
}

const when = { wantedDate: '2026-10-22', meal: 'dinner', wantedTime: '19:00', note: '少辣' };
const create = (k, items = ['r_pork'], extra = {}, token = k.a.token, state = k.s) =>
  call(state, 'requests.create', { items, servings: 3, ...when, ...extra }, token);
const req = (r) => r.state.orders.at(-1);

test('scale needs by servings', () => {
  const k = kitchen();
  assert.equal(computeNeeds([PORK], 3, k.s.inventory).find((n) => n.name === '五花肉').qty, 750);
});

test('shortage goes to shopping', () => {
  const k = kitchen({ porkQty: 200 });
  const r = create(k);
  assert.equal(r.status, 200);
  assert.deepEqual(req(r).shortages.map((x) => [x.name, x.qty, x.reason]), [['五花肉', 550, 'short']]);
  assert.equal(r.state.shopping[0].qty, 550);
});

test('shopping reason carries dish and date', () => {
  const k = kitchen({ porkQty: 200 });
  const r = create(k);
  const reason = r.state.shopping[0].reasons[0];
  assert.deepEqual([reason.orderUid, reason.dishes, reason.wantedDate, reason.meal], [req(r).uid, ['红烧肉'], '2026-10-22', 'dinner']);
});

test('unit mismatch is flagged not deducted', () => {
  const k = kitchen();
  let r = create(k, ['r_tomato']);
  const uid = req(r).uid;
  assert.equal(req(r).shortages[0].reason, 'unitMismatch');
  assert.equal(r.state.shopping.length, 0);
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.done', { uid }, k.b.token);
  assert.equal(r.state.inventory.find((i) => i.name === '番茄').qty, 300);
});

test('create rejects unknown or archived dishes', () => {
  const k = kitchen();
  assert.equal(create(k, ['nope']).status, 400);
  const archived = { ...k.s, recipes: [{ ...PORK, archived: true }, TOMATO] };
  assert.equal(create(k, ['r_pork'], {}, k.a.token, archived).status, 400);
});

test('create rejects past date, bad meal and bad time', () => {
  const k = kitchen();
  assert.equal(create(k, ['r_pork'], { wantedDate: '2026-10-21' }).status, 400);
  assert.equal(create(k, ['r_pork'], { meal: 'brunch' }).status, 400);
  assert.equal(create(k, ['r_pork'], { wantedTime: '25:00' }).status, 400);
});

test('servings must be 1 to 20', () => {
  const k = kitchen();
  assert.equal(create(k, ['r_pork'], { servings: 0 }).status, 400);
  assert.equal(create(k, ['r_pork'], { servings: 21 }).status, 400);
});

test('created event goes to everyone else with shortages', () => {
  const k = kitchen({ porkQty: 200 });
  const r = create(k);
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.deepEqual([e.type, e.to, e.who, e.dishes, e.servings, e.shortages, e.selfCook],
    ['request.created', 'tok-b', '小明', ['红烧肉'], 3, ['五花肉'], false]);
});

test('selfCook creates a taken request', () => {
  const k = kitchen();
  const r = create(k, ['r_pork'], { selfCook: true });
  assert.deepEqual([req(r).status, req(r).takerUid], ['taken', k.a.uid]);
  assert.deepEqual(r.events.map((e) => [e.type, e.selfCook]), [['request.created', true]]);
});

test('anyone can take an open request', () => {
  const k = kitchen();
  let r = create(k);
  r = call(r.state, 'requests.take', { uid: req(r).uid }, k.b.token);
  assert.deepEqual([req(r).status, req(r).takerUid], ['taken', k.b.uid]);
  assert.deepEqual(r.events, [{ type: 'request.taken', to: 'tok-a', taker: '小红', dishes: ['红烧肉'] }]);
});

test('second take conflicts', () => {
  const k = kitchen();
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  const again = call(r.state, 'requests.take', { uid }, k.a.token);
  assert.equal(again.status, 409);
  assert.match(again.body.error.message, /已经有人接了/);
});

test('only taker can release or finish', () => {
  const k = kitchen();
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  assert.equal(call(r.state, 'requests.release', { uid }, k.a.token).status, 403);
  assert.equal(call(r.state, 'requests.done', { uid }, k.a.token).status, 403);
});

test('release returns to open and notifies requester', () => {
  const k = kitchen();
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.release', { uid }, k.b.token);
  assert.deepEqual([req(r).status, req(r).takerUid], ['open', '']);
  assert.deepEqual(r.events, [{ type: 'request.released', to: 'tok-a', taker: '小红', dishes: ['红烧肉'] }]);
});

test('requester cancels taken request and taker is told', () => {
  const k = kitchen({ porkQty: 200 });
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.cancel', { uid }, k.a.token);
  assert.equal(req(r).status, 'cancelled');
  assert.equal(r.state.shopping[0].removed, true);
  assert.deepEqual(r.events, [{ type: 'request.cancelled', to: 'tok-b', who: '小明', dishes: ['红烧肉'] }]);
});

test('only requester cancels', () => {
  const k = kitchen();
  const r = create(k);
  assert.equal(call(r.state, 'requests.cancel', { uid: req(r).uid }, k.b.token).status, 403);
});

test('done deducts and emits stock.low to taker', () => {
  const k = kitchen({ porkQty: 800, lowThreshold: 100 });
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.done', { uid }, k.b.token);
  assert.equal(r.state.inventory.find((i) => i.name === '五花肉').qty, 50);
  assert.equal(r.state.shopping[0].reasons[0].type, 'low');
  assert.deepEqual(r.events, [
    { type: 'request.done', to: 'tok-a', taker: '小红', dishes: ['红烧肉'] },
    { type: 'stock.low', to: 'tok-b', name: '五花肉' },
  ]);
});

test('cooking for yourself sends no done push', () => {
  const k = kitchen({ lowThreshold: 0 });
  let r = create(k, ['r_pork'], { selfCook: true });
  r = call(r.state, 'requests.done', { uid: req(r).uid }, k.a.token);
  assert.deepEqual(r.events, []);
});

test('done is idempotent', () => {
  const k = kitchen();
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.done', { uid }, k.b.token);
  const again = call(r.state, 'requests.done', { uid }, k.b.token);
  assert.equal(again.status, 409);
  assert.equal(again.state.inventory.find((i) => i.name === '五花肉').qty, 50);
});

test('take cancelled request conflicts', () => {
  const k = kitchen();
  let r = create(k);
  const uid = req(r).uid;
  r = call(r.state, 'requests.cancel', { uid }, k.a.token);
  assert.equal(call(r.state, 'requests.take', { uid }, k.b.token).status, 409);
});

test('no event when no push token', () => {
  const k = kitchen();
  const s = call(k.s, 'me.update', { pushToken: '' }, k.b.token).state;
  const r = create(k, ['r_pork'], {}, k.a.token, s);
  assert.equal(r.status, 200);
  assert.deepEqual(r.events, []);
});

test('availability lists missing names', () => {
  const k = kitchen();
  const s = { ...k.s, recipes: [...k.s.recipes, recipe('r_noodle', '葱油拌面', [{ name: '小葱', qty: 2, unit: '根', kind: 'main', inventoryUid: null }])] };
  const v = call(s, 'state.get', {}, k.a.token).body.data;
  assert.deepEqual(v.availability.r_noodle, { makeable: false, missing: ['小葱'] });
  assert.equal(v.availability.r_pork.makeable, true);
});

test('doneCounts only done', () => {
  const k = kitchen();
  let r = create(k, ['r_pork', 'r_tomato']);
  const uid = req(r).uid;
  r = create(k, ['r_pork'], {}, k.a.token, r.state);
  r = call(r.state, 'requests.take', { uid }, k.b.token);
  r = call(r.state, 'requests.done', { uid }, k.b.token);
  assert.deepEqual(r.body.data.doneCounts, { r_pork: 1, r_tomato: 1 });
  assert.equal(r.body.data.requests.length, 2);
});

test('stock bought after asking is still deducted', () => {
  const a = register(emptyState(), '小明', '1111');
  const b = register(a.state, '小红', '2222');
  let s = { ...b.state, recipes: [PORK] };
  let r = call(s, 'requests.create', { items: ['r_pork'], servings: 3, ...when }, a.token);
  const uid = req(r).uid;
  const shop = r.state.shopping.find((x) => x.name === '五花肉');
  r = call(r.state, 'shopping.check', { uid: shop.uid, boughtQty: 1, unit: 'kg' }, b.token);
  assert.equal(r.state.inventory[0].qty, 1000);
  r = call(r.state, 'requests.take', { uid }, b.token);
  r = call(r.state, 'requests.done', { uid }, b.token);
  assert.equal(r.state.inventory[0].qty, 250);
});
