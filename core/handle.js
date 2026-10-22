import { STATE_KEYS } from './schema.js';
import { authenticate } from './session.js';
import { view } from './view.js';

const STATUS = {
  BAD_INPUT: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, NO_USERS: 404,
  CONFLICT: 409, NEEDS_IMAGES: 422, NEEDS_FALLBACK: 422, LOCKED: 423, UPSTREAM: 502,
};

const ACTIONS = {};

// role: 'public' (no login), 'any' (logged in), 'chef'
export function register(name, role, run) {
  ACTIONS[name] = { role, run };
}

export function fail(code, message, writes) {
  const err = new Error(message);
  err.code = code;
  err.writes = writes;
  return err;
}

export function applyWrites(state, writes = {}) {
  const next = { ...state };
  for (const [table, rows] of Object.entries(writes)) {
    const key = STATE_KEYS[table];
    const list = [...next[key]];
    for (const row of rows) {
      const i = list.findIndex((r) => r.uid === row.uid);
      if (i >= 0) list[i] = row; else list.push(row);
    }
    next[key] = list;
  }
  return next;
}

// Writes accumulate per table; a later write of the same uid replaces the earlier one.
// When given a state, w.state always reflects the writes so far, for multi-step actions.
export function writer(state) {
  const writes = {};
  const w = {
    writes,
    state,
    put(table, row) {
      const rows = (writes[table] ??= []);
      const i = rows.findIndex((r) => r.uid === row.uid);
      if (i >= 0) rows[i] = row; else rows.push(row);
      if (w.state) w.state = applyWrites(w.state, { [table]: [row] });
      return row;
    },
  };
  return w;
}

export function handle(action, state, payload, ctx) {
  const entry = ACTIONS[action];
  try {
    if (!entry) throw fail('BAD_INPUT', '不认识的操作');
    let me = null;
    if (entry.role !== 'public') {
      me = authenticate(state, ctx.token, ctx.now);
      if (!me) throw fail('UNAUTHORIZED', '请先登录');
      if (entry.role === 'chef' && me.role !== 'chef') throw fail('FORBIDDEN', '只有厨师可以这样做');
    }
    const out = entry.run(state, payload ?? {}, ctx, me) ?? {};
    const writes = out.writes ?? {};
    const after = applyWrites(state, writes);
    const viewer = out.me ?? (me && after.users.find((u) => u.uid === me.uid));
    const data = 'data' in out ? out.data : view(after, viewer, ctx);
    return { status: 200, body: { ok: true, data }, writes, events: out.events ?? [] };
  } catch (err) {
    if (!err.code) throw err;
    return {
      status: STATUS[err.code] ?? 400,
      body: { ok: false, error: { code: err.code, message: err.message } },
      writes: err.writes ?? {},
      events: [],
    };
  }
}
