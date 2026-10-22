import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from './sha256.js';
import { call, emptyState, register } from './testkit.js';

test('sha256 vector', () =>
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));

test('sha256 handles utf-8', () =>
  assert.equal(sha256Hex('搭伙小灶').length, 64));

test('anyone can register and is a member', () => {
  const r = call(emptyState(), 'auth.register', { name: '小明', pin: '1234' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.view.me.role, 'member');
  assert.match(r.body.data.token, /^[0-9a-f]{64}$/);
});

test('register rejects duplicate name', () => {
  const a = register(emptyState(), '小明');
  assert.equal(call(a.state, 'auth.register', { name: ' 小明 ', pin: '1111' }).status, 409);
});

test('register is capped at six members', () => {
  let state = emptyState();
  for (let i = 1; i <= 6; i++) state = register(state, `人${i}`).state;
  const r = call(state, 'auth.register', { name: '人7', pin: '1111' });
  assert.equal(r.status, 403);
  assert.match(r.body.error.message, /6/);
});

test('old setup and member creation are gone', () => {
  const a = register();
  assert.equal(call(emptyState(), 'auth.setup', { name: 'x', pin: '1234' }).status, 400);
  assert.equal(call(a.state, 'users.create', { name: 'y', pin: '1234' }, a.token).status, 400);
});

test('login with unknown name is unauthorized', () => {
  const r = call(emptyState(), 'auth.login', { name: '谁', pin: '1234' });
  assert.equal(r.status, 401);
});

test('login ok returns 30-day session', () => {
  const { state } = register();
  const r = call(state, 'auth.login', { name: '小明', pin: '1234' });
  assert.equal(r.status, 200);
  const s = r.state.sessions.find((x) => x.uid === r.body.data.token);
  assert.equal(s.expiresIso, '2026-11-21T10:00:00.000Z');
});

test('lockout after five failures', () => {
  let { state } = register();
  for (let i = 0; i < 5; i++) {
    const r = call(state, 'auth.login', { name: '小明', pin: '0000' });
    assert.equal(r.status, 401);
    state = r.state;
  }
  assert.equal(call(state, 'auth.login', { name: '小明', pin: '1234' }).status, 423);
  const later = call(state, 'auth.login', { name: '小明', pin: '1234' }, '', { now: '2026-10-22T10:16:00.000Z' });
  assert.equal(later.status, 200);
  assert.equal(later.state.users[0].failedLogins, 0);
});

test('pin must be 4 digits', () => {
  assert.equal(call(emptyState(), 'auth.register', { name: '小明', pin: '12a4' }).status, 400);
});

test('unauthenticated state.get', () => {
  const { state } = register();
  assert.equal(call(state, 'state.get', {}, 'nope').status, 401);
});

test('expired session is rejected', () => {
  const { state, token } = register();
  assert.equal(call(state, 'state.get', {}, token, { now: '2026-12-01T00:00:00.000Z' }).status, 401);
});

test('logout expires the session', () => {
  const { state, token } = register();
  const out = call(state, 'auth.logout', {}, token);
  assert.equal(call(out.state, 'state.get', {}, token).status, 401);
});

test('unknown action is bad input', () => {
  const { state, token } = register();
  assert.equal(call(state, 'nope.nope', {}, token).status, 400);
});

test('view hides secrets', () => {
  const a = register();
  let r = call(a.state, 'me.update', { pushToken: 'PUSHSECRET123' }, a.token);
  r = call(r.state, 'state.get', {}, a.token);
  const text = JSON.stringify(r.body);
  const u = r.state.users[0];
  for (const secret of [u.pinHash, u.pinSalt, 'PUSHSECRET123', a.token]) assert.ok(!text.includes(secret));
  assert.equal(r.body.data.me.hasPush, true);
});

test('every member sees inventory and shopping', () => {
  const a = register(emptyState(), '小明');
  const b = register(a.state, '小红');
  const v = call(b.state, 'state.get', {}, b.token).body.data;
  assert.ok(Array.isArray(v.inventory));
  assert.ok(Array.isArray(v.shopping));
});

test('any member can reset a pin', () => {
  const a = register(emptyState(), '小明');
  const b = register(a.state, '小红', '5678');
  const r = call(b.state, 'users.resetPin', { uid: b.uid, pin: '9999' }, a.token);
  assert.equal(r.status, 200);
  assert.equal(call(r.state, 'auth.login', { name: '小红', pin: '9999' }).status, 200);
});

test('testPush without token', () => {
  const a = register();
  const r = call(a.state, 'me.testPush', {}, a.token);
  assert.equal(r.status, 400);
  assert.match(r.body.error.message, /PushPlus/);
});

test('testPush emits event to self', () => {
  const a = register();
  const s = call(a.state, 'me.update', { pushToken: 'tok-a' }, a.token).state;
  assert.deepEqual(call(s, 'me.testPush', {}, a.token).events, [{ type: 'push.test', to: 'tok-a' }]);
});
