import { register, fail, writer } from './handle.js';
import { sha256Hex } from './sha256.js';
import { newId } from './ids.js';
import { addDays, addMinutes } from './time.js';
import { view } from './view.js';
import { sameName } from './names.js';

const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
export const MAX_MEMBERS = 6;

export function hashPin(pin, salt) {
  return sha256Hex(`${salt}:${pin}`);
}

function checkPin(pin) {
  if (!/^\d{4}$/.test(String(pin ?? ''))) throw fail('BAD_INPUT', '口令要是 4 位数字');
}

function checkName(name) {
  const n = String(name ?? '').trim();
  if (!n || n.length > 20) throw fail('BAD_INPUT', '名字要 1 到 20 个字');
  return n;
}

// Salt and session token are derived separately so neither reveals the other.
function newSalt(ctx, uid) {
  return sha256Hex(`${ctx.rand}:salt:${uid}`).slice(0, 16);
}

function newUser(ctx, name, pin, role) {
  const uid = newId(ctx, 'u');
  const pinSalt = newSalt(ctx, uid);
  return {
    uid, name, role, pinSalt, pinHash: hashPin(pin, pinSalt), pushToken: '', avatar: '',
    failedLogins: 0, lockedUntilIso: '', createdIso: ctx.now,
  };
}

function newSession(ctx, user) {
  return { uid: sha256Hex(`${ctx.rand}:session`), userUid: user.uid, expiresIso: addDays(ctx.now, SESSION_DAYS) };
}

function signedIn(state, w, ctx, user) {
  const session = w.put('pk_sessions', newSession(ctx, user));
  const after = { ...state, users: state.users.map((u) => (u.uid === user.uid ? user : u)) };
  if (!after.users.some((u) => u.uid === user.uid)) after.users.push(user);
  after.sessions = [...state.sessions, session];
  return { writes: w.writes, data: { token: session.uid, view: view(after, user, ctx) } };
}

register('auth.register', 'public', (state, p, ctx) => {
  const name = checkName(p.name);
  checkPin(p.pin);
  if (state.users.some((u) => sameName(u.name, name))) throw fail('CONFLICT', '已经有人叫这个名字了');
  if (state.users.length >= MAX_MEMBERS) throw fail('FORBIDDEN', `人满了，最多 ${MAX_MEMBERS} 个人`);
  const w = writer();
  const member = w.put('pk_users', newUser(ctx, name, p.pin, 'member'));
  return signedIn(state, w, ctx, member);
});

register('auth.login', 'public', (state, p, ctx) => {
  const name = String(p.name ?? '').trim();
  const user = state.users.find((u) => sameName(u.name, name));
  if (!user) throw fail('UNAUTHORIZED', '名字或口令不对');
  if (user.lockedUntilIso && user.lockedUntilIso > ctx.now) throw fail('LOCKED', '错太多次了，15 分钟后再试');
  const w = writer();
  if (hashPin(p.pin, user.pinSalt) !== user.pinHash) {
    const fails = user.failedLogins + 1;
    const locked = fails >= MAX_FAILS;
    w.put('pk_users', {
      ...user,
      failedLogins: locked ? 0 : fails,
      lockedUntilIso: locked ? addMinutes(ctx.now, LOCK_MINUTES) : user.lockedUntilIso,
    });
    throw fail('UNAUTHORIZED', '名字或口令不对', w.writes);
  }
  const ok = w.put('pk_users', { ...user, failedLogins: 0, lockedUntilIso: '' });
  return signedIn(state, w, ctx, ok);
});

register('auth.logout', 'any', (state, p, ctx) => {
  const w = writer();
  const s = state.sessions.find((x) => x.uid === ctx.token);
  w.put('pk_sessions', { ...s, expiresIso: ctx.now });
  return { writes: w.writes, data: null };
});

register('state.get', 'any', () => ({}));

register('users.resetPin', 'any', (state, p, ctx) => {
  checkPin(p.pin);
  const user = state.users.find((u) => u.uid === p.uid);
  if (!user) throw fail('NOT_FOUND', '找不到这个人');
  const pinSalt = newSalt(ctx, user.uid);
  const w = writer();
  w.put('pk_users', { ...user, pinSalt, pinHash: hashPin(p.pin, pinSalt), failedLogins: 0, lockedUntilIso: '' });
  return { writes: w.writes };
});

register('me.update', 'any', (state, p, ctx, me) => {
  const w = writer();
  const next = { ...me };
  if (p.pushToken !== undefined) next.pushToken = String(p.pushToken).trim();
  if (p.avatar !== undefined) next.avatar = String(p.avatar).trim();
  w.put('pk_users', next);
  return { writes: w.writes };
});

register('me.testPush', 'any', (state, p, ctx, me) => {
  if (!me.pushToken) throw fail('BAD_INPUT', '先在下面填好 PushPlus 的 token');
  return { events: [{ type: 'push.test', to: me.pushToken }] };
});
