// Test helpers only — never imported by production code.
import { handle, applyWrites } from './index.js';
import { stateFromTables } from './schema.js';
import { sha256Hex } from './sha256.js';

let n = 0;
export function mkCtx(over = {}) {
  n += 1;
  const rand = sha256Hex(`test-rand-${n}`);
  return { now: '2026-10-22T10:00:00.000Z', rand, tz: 'Europe/Amsterdam', seq: 0, ...over };
}

export function emptyState() {
  return stateFromTables({});
}

// Runs one action and returns the result plus the state after its writes.
export function call(state, action, payload = {}, token = '', ctxOver = {}) {
  const r = handle(action, state, payload, { ...mkCtx(ctxOver), token });
  return { ...r, state: applyWrites(state, r.writes) };
}

export function setupChef(pin = '1234', name = '大厨') {
  const r = call(emptyState(), 'auth.setup', { name, pin });
  return { state: r.state, token: r.body.data.token, uid: r.body.data.view.me.uid };
}

export function addDiner(base, name = '小明', pin = '5678') {
  let r = call(base.state, 'users.create', { name, pin }, base.token);
  r = call(r.state, 'auth.login', { name, pin });
  return { state: r.state, token: r.body.data.token, uid: r.body.data.view.me.uid };
}
