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

async function pushTo(token, includes) {
  for (let i = 0; i < 24; i++) {
    const p = mock.pushes.find((x) => x.token === token && `${x.title}${x.content}`.includes(includes));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.fail(`no push to ${token} containing ${includes}: ${JSON.stringify(mock.pushes)}`);
}

const ask = (token, items, extra = {}) => n8n.api('requests.create', { items, servings: 3, wantedDate: today, meal: 'dinner', wantedTime: '', note: '', ...extra }, token);

test('register two members and see preset recipes', async () => {
  const a = await n8n.api('auth.register', { name: '小明', pin: '1111' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const b = await n8n.api('auth.register', { name: '小红', pin: '2222' });
  assert.equal(b.status, 200);
  t.a = a.body.data.token;
  t.b = b.body.data.token;
  await n8n.api('me.update', { pushToken: 'tok-a' }, t.a);
  await n8n.api('me.update', { pushToken: 'tok-b' }, t.b);
  const v = (await n8n.api('state.get', {}, t.a)).body.data;
  assert.equal(v.recipes.length, 12);
  t.pork = v.recipes.find((r) => r.name === '红烧肉').uid;
});

test('bad token is 401', async () => {
  const r = await n8n.api('state.get', {}, 'not-a-token');
  assert.equal(r.status, 401);
});

test('A asks, B is told what is missing', async () => {
  const r = await ask(t.a, [t.pork]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  t.req = r.body.data.requests.at(-1).uid;
  const push = await pushTo('tok-b', '红烧肉');
  assert.match(push.title, /小明 想吃 红烧肉/);
  assert.match(push.content, /缺：五花肉/);
  assert.match(push.content, /已加进采购清单/);
});

test('ticking the shopping list stocks the kitchen', async () => {
  const v = (await n8n.api('state.get', {}, t.b)).body.data;
  const item = v.shopping.find((s) => s.name === '五花肉');
  assert.equal(item.qty, 750);
  assert.deepEqual(item.reasons[0].dishes, ['红烧肉']);
  const r = await n8n.api('shopping.check', { uid: item.uid, boughtQty: 800, unit: 'g' }, t.b);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.inventory.find((i) => i.name === '五花肉').qty, 800);
});

test('B takes and A hears about it', async () => {
  const r = await n8n.api('requests.take', { uid: t.req }, t.b);
  assert.equal(r.status, 200);
  await pushTo('tok-a', '小红 接了你的');
});

test('B finishes, stock drops and A is called to eat', async () => {
  const r = await n8n.api('requests.done', { uid: t.req }, t.b);
  assert.equal(r.status, 200);
  const v = (await n8n.api('state.get', {}, t.a)).body.data;
  assert.equal(v.inventory.find((i) => i.name === '五花肉').qty, 50);
  assert.equal(v.doneCounts[t.pork], 1);
  await pushTo('tok-a', '出锅啦');
});

test('concurrent takes: one wins', async () => {
  const r = await ask(t.a, [t.pork], { servings: 1 });
  const uid = r.body.data.requests.at(-1).uid;
  const [x, y] = await Promise.all([n8n.api('requests.take', { uid }, t.a), n8n.api('requests.take', { uid }, t.b)]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
});

test('CORS preflight allowed', async () => {
  const r = await fetch(`${BASE}/webhook/pk/api`, {
    method: 'OPTIONS',
    headers: { origin: 'https://example.github.io', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
  });
  assert.ok(r.status < 300, String(r.status));
  assert.ok(r.headers.get('access-control-allow-origin'));
});
