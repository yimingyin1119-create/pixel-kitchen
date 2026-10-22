// Test helpers only — never imported by production code.
import { handle, applyWrites } from './index.js';
import { stateFromTables } from './schema.js';
import { sha256Hex } from './sha256.js';

let n = 0;
export function mkCtx(over = {}) {
  n += 1;
  const rand = sha256Hex(`test-rand-${n}`);
  return { now: '2026-10-22T10:00:00.000Z', rand, tz: 'Asia/Singapore', seq: 0, ...over };
}

export function emptyState() {
  return stateFromTables({});
}

// Runs one action and returns the result plus the state after its writes.
export function call(state, action, payload = {}, token = '', ctxOver = {}) {
  const r = handle(action, state, payload, { ...mkCtx(ctxOver), token });
  return { ...r, state: applyWrites(state, r.writes) };
}

export function register(state = emptyState(), name = '小明', pin = '1234') {
  const r = call(state, 'auth.register', { name, pin });
  if (r.status !== 200) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
  return { state: r.state, token: r.body.data.token, uid: r.body.data.view.me.uid };
}

// Older tests call the first member "chef" and the second "diner"; with no roles they are just two members.
export function setupChef(pin = '1234', name = '大厨') {
  return register(emptyState(), name, pin);
}

export function addDiner(base, name = '小明', pin = '5678') {
  return register(base.state, name, pin);
}
