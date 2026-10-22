import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, lowStockCheck } from './stock.js';
import { call, setupChef, addDiner } from './testkit.js';

function chefWithStock(items) {
  const chef = setupChef();
  let state = chef.state;
  for (const item of items) state = call(state, 'inventory.save', { item }, chef.token).state;
  return { ...chef, state };
}

const pork = { name: '五花肉', kind: 'main', qty: 600, unit: 'g', lowThreshold: 100 };

test('inventory.save creates and updates', () => {
  const c = chefWithStock([pork]);
  const uid = c.state.inventory[0].uid;
  const r = call(c.state, 'inventory.save', { item: { ...c.state.inventory[0], qty: 50 } }, c.token);
  assert.equal(r.state.inventory.length, 1);
  assert.equal(r.state.inventory[0].qty, 50);
  assert.equal(r.state.inventory[0].uid, uid);
});

test('inventory.save rejects negative qty', () => {
  const c = setupChef();
  assert.equal(call(c.state, 'inventory.save', { item: { ...pork, qty: -1 } }, c.token).status, 400);
});

test('shopping merges same item', () => {
  const c = setupChef();
  let r = call(c.state, 'shopping.add', { name: '小葱', qty: 1, unit: '把' }, c.token);
  r = call(r.state, 'shopping.add', { name: '小葱', qty: 2, unit: '把' }, c.token);
  assert.equal(r.state.shopping.length, 1);
  assert.equal(r.state.shopping[0].qty, 3);
  assert.equal(r.state.shopping[0].reasons.length, 2);
});

test('check adds stock with conversion', () => {
  const c = chefWithStock([pork]);
  let r = call(c.state, 'shopping.add', { name: '五花肉', qty: 500, unit: 'g' }, c.token);
  r = call(r.state, 'shopping.check', { uid: r.state.shopping[0].uid, boughtQty: 1, unit: '斤' }, c.token);
  assert.equal(r.state.inventory[0].qty, 1100);
  assert.equal(r.state.shopping[0].done, true);
});

test('check with incompatible unit is rejected', () => {
  const c = chefWithStock([pork]);
  let r = call(c.state, 'shopping.add', { name: '五花肉', qty: 500, unit: 'g' }, c.token);
  r = call(r.state, 'shopping.check', { uid: r.state.shopping[0].uid, boughtQty: 2, unit: '个' }, c.token);
  assert.equal(r.status, 400);
});

test('check creates inventory when none', () => {
  const c = setupChef();
  let r = call(c.state, 'shopping.add', { name: '小葱', qty: 1, unit: '把' }, c.token);
  r = call(r.state, 'shopping.check', { uid: r.state.shopping[0].uid, boughtQty: 1, expiresOn: '2026-10-28' }, c.token);
  assert.equal(r.state.inventory.length, 1);
  assert.deepEqual([r.state.inventory[0].name, r.state.inventory[0].qty, r.state.inventory[0].expiresOn], ['小葱', 1, '2026-10-28']);
});

test('checking twice conflicts', () => {
  const c = setupChef();
  let r = call(c.state, 'shopping.add', { name: '小葱', qty: 1, unit: '把' }, c.token);
  const uid = r.state.shopping[0].uid;
  r = call(r.state, 'shopping.check', { uid, boughtQty: 1 }, c.token);
  assert.equal(call(r.state, 'shopping.check', { uid, boughtQty: 1 }, c.token).status, 409);
});

test('uncheck reverses', () => {
  const c = chefWithStock([pork]);
  let r = call(c.state, 'shopping.add', { name: '五花肉', qty: 500, unit: 'g' }, c.token);
  const uid = r.state.shopping[0].uid;
  r = call(r.state, 'shopping.check', { uid, boughtQty: 500 }, c.token);
  r = call(r.state, 'shopping.uncheck', { uid }, c.token);
  assert.equal(r.state.inventory[0].qty, 600);
  assert.equal(r.state.shopping[0].done, false);
});

test('available subtracts open orders', () => {
  const item = { uid: 'i1', qty: 600, unit: 'g' };
  const state = {
    orders: [
      { uid: 'o1', status: 'pending', needs: [{ inventoryUid: 'i1', qty: 500 }] },
      { uid: 'o2', status: 'done', needs: [{ inventoryUid: 'i1', qty: 300 }] },
    ],
  };
  assert.equal(available(item, state), 100);
  assert.equal(available(item, state, 'o1'), 600);
});

test('seasoning check resets status ok', () => {
  const c = chefWithStock([{ name: '盐', kind: 'seasoning', qty: 0, unit: '', status: 'out' }]);
  let r = call(c.state, 'shopping.add', { name: '盐', qty: 1, unit: '包' }, c.token);
  r = call(r.state, 'shopping.check', { uid: r.state.shopping[0].uid, boughtQty: 1 }, c.token);
  assert.equal(r.state.inventory[0].status, 'ok');
});

test('lowStockCheck by kind', () => {
  assert.equal(lowStockCheck({ kind: 'main', qty: 100, lowThreshold: 100 }), true);
  assert.equal(lowStockCheck({ kind: 'main', qty: 101, lowThreshold: 100 }), false);
  assert.equal(lowStockCheck({ kind: 'seasoning', status: 'low' }), true);
});

test('any member can work the shopping list', () => {
  const c = setupChef();
  const d = addDiner(c);
  assert.equal(call(d.state, 'shopping.add', { name: '葱', qty: 1, unit: '把' }, d.token).status, 200);
});

test('duplicate stock names ignore spaces and case', () => {
  const c = chefWithStock([pork]);
  const r = call(c.state, 'inventory.save', { item: { ...pork, name: ' 五花肉 ' } }, c.token);
  assert.equal(r.status, 409);
  assert.match(r.body.error.message, /已经有「五花肉」了/);
});

test('hidden stock is not matched', () => {
  const c = chefWithStock([pork]);
  let r = call(c.state, 'inventory.remove', { uid: c.state.inventory[0].uid }, c.token);
  assert.deepEqual(r.body.data.inventory, []);
  r = call(r.state, 'shopping.add', { name: '五花肉', qty: 100, unit: 'g' }, c.token);
  assert.equal(r.state.shopping[0].inventoryUid, '');
  assert.equal(call(r.state, 'inventory.save', { item: pork }, c.token).status, 200);
});

test('only manual shopping items can be removed', () => {
  const c = setupChef();
  let r = call(c.state, 'shopping.add', { name: '小葱', qty: 1, unit: '把' }, c.token);
  const manual = r.state.shopping[0].uid;
  r = call(r.state, 'shopping.remove', { uid: manual }, c.token);
  assert.equal(r.state.shopping[0].removed, true);
  const forDish = { ...r.state, shopping: [{ uid: 's2', name: '肉', inventoryUid: '', qty: 1, unit: 'g', reasons: [{ type: 'order', orderUid: 'o1', qty: 1 }], done: false, boughtQty: 0, doneIso: '', removed: false }] };
  assert.equal(call(forDish, 'shopping.remove', { uid: 's2' }, c.token).status, 400);
});
