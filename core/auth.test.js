import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from './sha256.js';
import { call, emptyState, setupChef, addDiner } from './testkit.js';

test('sha256 vector', () =>
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));

test('sha256 handles utf-8', () =>
  assert.equal(sha256Hex('乡村小厨').length, 64));

test('setup only when no users', () => {
  const first = call(emptyState(), 'auth.setup', { name: '大厨', pin: '1234' });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.view.me.role, 'chef');
  assert.match(first.body.data.token, /^[0-9a-f]{64}$/);
  const second = call(first.state, 'auth.setup', { name: '又一个', pin: '1111' });
  assert.equal(second.status, 403);
});

test('login with empty user table', () => {
  const r = call(emptyState(), 'auth.login', { name: '谁', pin: '1234' });
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'NO_USERS');
});

test('login ok returns 30-day session', () => {
  const { state } = setupChef();
  const r = call(state, 'auth.login', { name: '大厨', pin: '1234' });
  assert.equal(r.status, 200);
  const s = r.state.sessions.find((x) => x.uid === r.body.data.token);
  assert.equal(s.expiresIso, '2026-11-21T10:00:00.000Z');
});

test('lockout after five failures', () => {
  let { state } = setupChef();
  for (let i = 0; i < 5; i++) {
    const r = call(state, 'auth.login', { name: '大厨', pin: '0000' });
    assert.equal(r.status, 401);
    state = r.state;
  }
  const locked = call(state, 'auth.login', { name: '大厨', pin: '1234' });
  assert.equal(locked.status, 423);
  const later = call(state, 'auth.login', { name: '大厨', pin: '1234' }, '', { now: '2026-10-22T10:16:00.000Z' });
  assert.equal(later.status, 200);
  assert.equal(later.state.users[0].failedLogins, 0);
});

test('pin must be 4 digits', () => {
  assert.equal(call(emptyState(), 'auth.setup', { name: '大厨', pin: '12a4' }).status, 400);
});

test('diner cannot users.create', () => {
  const diner = addDiner(setupChef());
  assert.equal(call(diner.state, 'users.create', { name: '小红', pin: '1111' }, diner.token).status, 403);
});

test('duplicate member name conflicts', () => {
  const chef = setupChef();
  assert.equal(call(chef.state, 'users.create', { name: '大厨', pin: '1111' }, chef.token).status, 409);
});

test('unauthenticated state.get', () => {
  const { state } = setupChef();
  assert.equal(call(state, 'state.get', {}, 'nope').status, 401);
});

test('expired session is rejected', () => {
  const { state, token } = setupChef();
  assert.equal(call(state, 'state.get', {}, token, { now: '2026-12-01T00:00:00.000Z' }).status, 401);
});

test('logout expires the session', () => {
  const { state, token } = setupChef();
  const out = call(state, 'auth.logout', {}, token);
  assert.equal(call(out.state, 'state.get', {}, token).status, 401);
});

test('unknown action is bad input', () => {
  const { state, token } = setupChef();
  assert.equal(call(state, 'nope.nope', {}, token).status, 400);
});

test('view hides secrets', () => {
  const chef = setupChef();
  let r = call(chef.state, 'me.update', { pushToken: 'PUSHSECRET123' }, chef.token);
  r = call(r.state, 'state.get', {}, chef.token);
  const text = JSON.stringify(r.body);
  const u = r.state.users[0];
  for (const secret of [u.pinHash, u.pinSalt, 'PUSHSECRET123', chef.token]) assert.ok(!text.includes(secret));
  assert.equal(r.body.data.me.hasPush, true);
});

test('diner view excludes inventory, shopping, others orders', () => {
  const diner = addDiner(setupChef());
  const st = { ...diner.state, orders: [{ uid: 'o1', userUid: 'someone', items: [], status: 'pending' }] };
  const v = call(st, 'state.get', {}, diner.token).body.data;
  assert.equal(v.inventory, undefined);
  assert.equal(v.shopping, undefined);
  assert.deepEqual(v.orders, []);
});

test('testPush without token', () => {
  const chef = setupChef();
  const r = call(chef.state, 'me.testPush', {}, chef.token);
  assert.equal(r.status, 400);
  assert.match(r.body.error.message, /PushPlus/);
});

test('testPush emits event to self', () => {
  const chef = setupChef();
  const s = call(chef.state, 'me.update', { pushToken: 'tok-chef' }, chef.token).state;
  const r = call(s, 'me.testPush', {}, chef.token);
  assert.deepEqual(r.events, [{ type: 'push.test', to: 'tok-chef' }]);
});

test('chef resets a member pin', () => {
  const chef = setupChef();
  const diner = addDiner(chef);
  const r = call(diner.state, 'users.resetPin', { uid: diner.uid, pin: '9999' }, chef.token);
  assert.equal(call(r.state, 'auth.login', { name: '小明', pin: '9999' }).status, 200);
});
