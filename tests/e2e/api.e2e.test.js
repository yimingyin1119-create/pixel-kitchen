import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startN8n, BASE } from './harness.mjs';
import { startMockUpstream } from './mock-upstream.mjs';

let n8n;
let mock;
const t = {};

before(async () => {
  mock = await startMockUpstream();
  n8n = await startN8n();
}, { timeout: 240_000 });

after(async () => {
  await n8n?.stop();
  await mock?.close();
});

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());

test('setup → login → create diner', async () => {
  const setup = await n8n.api('auth.setup', { name: '大厨', pin: '1234' });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  t.chef = setup.body.data.token;
  const created = await n8n.api('users.create', { name: '小明', pin: '5678' }, t.chef);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const login = await n8n.api('auth.login', { name: '小明', pin: '5678' });
  assert.equal(login.status, 200);
  t.diner = login.body.data.token;
});

test('bad token is 401', async () => {
  const r = await n8n.api('state.get', {}, 'not-a-token');
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'UNAUTHORIZED');
});

test('diner orders, chef gets push', async () => {
  await n8n.api('me.update', { pushToken: 'tok-chef' }, t.chef);
  await n8n.api('inventory.save', { item: { name: '五花肉', kind: 'main', qty: 800, unit: 'g', lowThreshold: 100 } }, t.chef);
  const saved = await n8n.api('recipes.save', {
    recipe: { name: '红烧肉', baseServings: 2, ingredients: [{ name: '五花肉', qty: 500, unit: 'g', kind: 'main' }] },
  }, t.chef);
  t.pork = saved.body.data.recipes[0].uid;
  const placed = await n8n.api('orders.place', { items: [t.pork], servings: 3, wantedDate: today, meal: 'dinner', wantedTime: '', note: '' }, t.diner);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  t.order = placed.body.data.orders[0].uid;
  let push;
  for (let i = 0; i < 20 && !push; i++) {
    push = mock.pushes.find((p) => p.token === 'tok-chef' && p.content.includes('红烧肉'));
    if (!push) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(push, `push not received: ${JSON.stringify(mock.pushes)}`);
  assert.match(push.content, /3人/);
  assert.match(push.title, /小明/);
});

test('done deducts stock persisted', async () => {
  assert.equal((await n8n.api('orders.accept', { uid: t.order }, t.chef)).status, 200);
  assert.equal((await n8n.api('orders.done', { uid: t.order }, t.chef)).status, 200);
  const v = (await n8n.api('state.get', {}, t.chef)).body.data;
  assert.equal(v.inventory.find((i) => i.name === '五花肉').qty, 50);
  assert.equal(v.dishCounts[t.pork], 1);
});

test('concurrent writes both land', async () => {
  const add = await n8n.api('shopping.add', { name: '五花肉', qty: 500, unit: 'g' }, t.chef);
  const shop = add.body.data.shopping.find((s) => s.name === '五花肉' && !s.done);
  const [checked, placed] = await Promise.all([
    n8n.api('shopping.check', { uid: shop.uid, boughtQty: 1000 }, t.chef),
    n8n.api('orders.place', { items: [t.pork], servings: 2, wantedDate: today, meal: 'late', wantedTime: '', note: '' }, t.diner),
  ]);
  assert.equal(checked.status, 200);
  assert.equal(placed.status, 200);
  const v = (await n8n.api('state.get', {}, t.chef)).body.data;
  assert.equal(v.inventory.find((i) => i.name === '五花肉').qty, 1050);
  assert.equal(v.shopping.find((s) => s.uid === shop.uid).done, true);
  assert.equal(v.orders.filter((o) => o.status === 'pending').length, 1);
});

test('CORS preflight allowed', async () => {
  const r = await fetch(`${BASE}/webhook/pk/api`, {
    method: 'OPTIONS',
    headers: { origin: 'https://example.github.io', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
  });
  assert.ok(r.status < 300, String(r.status));
  assert.ok(r.headers.get('access-control-allow-origin'));
});
