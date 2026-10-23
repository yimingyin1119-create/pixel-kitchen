import { register, fail, writer } from './handle.js';
import { newId } from './ids.js';
import { convert, round1 } from './units.js';
import { localDate } from './time.js';
import { matchIngredient } from './recipes.js';
import { available, lowStockCheck, resolveNeed } from './stock.js';
import { addShoppingReason, removeOrderReason } from './shopping.js';
import { extendView } from './view.js';
import { isPantry } from './pantry.js';

const MEALS = ['lunch', 'dinner', 'late'];

function stockItem(ing, inventory) {
  return (ing.inventoryUid && inventory.find((i) => i.uid === ing.inventoryUid)) || matchIngredient(ing.name, inventory);
}

// What the dishes need for `servings` people, in stock units, merged per stock item.
export function computeNeeds(recipes, servings, inventory) {
  const byKey = new Map();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const item = stockItem(ing, inventory);
      let qty = ing.qty === null ? null : (ing.qty * servings) / (r.baseServings || 2);
      let unit = ing.unit;
      let unitMismatch = false;
      if (item && qty !== null) {
        const c = convert(qty, ing.unit, item.unit);
        if (c === null) { unitMismatch = true; qty = null; } else { qty = c; unit = item.unit; }
      }
      const key = item ? item.uid : `name:${ing.name}`;
      const prev = byKey.get(key);
      if (prev) {
        if (qty !== null) prev.qty = round1((prev.qty ?? 0) + qty);
        prev.unitMismatch ||= unitMismatch;
        if (prev.unitMismatch) prev.qty = null;
      } else {
        byKey.set(key, {
          name: item ? item.name : ing.name, inventoryUid: item ? item.uid : null,
          qty: qty === null ? null : round1(qty), unit, kind: item ? item.kind : ing.kind, unitMismatch,
        });
      }
    }
  }
  return [...byKey.values()];
}

export function computeShortages(needs, state, orderUid) {
  const out = [];
  for (const n of needs) {
    const item = n.inventoryUid && state.inventory.find((i) => i.uid === n.inventoryUid);
    if (n.unitMismatch) { out.push({ name: n.name, inventoryUid: n.inventoryUid, qty: null, unit: n.unit, reason: 'unitMismatch' }); continue; }
    if (!item) {
      // Untracked everyday seasonings "to taste" are assumed to be in the cupboard; anything else is missing.
      if (n.qty !== null || !isPantry(n)) out.push({ name: n.name, inventoryUid: null, qty: n.qty, unit: n.unit, reason: 'missing' });
      continue;
    }
    if (item.kind === 'seasoning') {
      if (item.status === 'out') out.push({ name: n.name, inventoryUid: item.uid, qty: null, unit: item.unit, reason: 'out' });
      continue;
    }
    if (n.qty === null) continue;
    const left = Math.max(0, available(item, state, orderUid));
    if (left < n.qty) out.push({ name: n.name, inventoryUid: item.uid, qty: round1(n.qty - left), unit: item.unit, reason: 'short' });
  }
  return out;
}

function tokenOf(state, uid) {
  return state.users.find((u) => u.uid === uid)?.pushToken || null;
}

function nameOf(state, uid) {
  return state.users.find((u) => u.uid === uid)?.name ?? '有人';
}

function dishNames(request) {
  return request.items.map((i) => i.name);
}

// Event to one member, or nothing when it would go to the actor themself or they have no push token.
function eventTo(state, toUid, actorUid, body) {
  const to = toUid && toUid !== actorUid ? tokenOf(state, toUid) : null;
  return to ? [{ ...body, to }] : [];
}

function findRequest(state, uid) {
  const o = state.orders.find((x) => x.uid === uid);
  if (!o) throw fail('NOT_FOUND', '找不到这个要求');
  return o;
}

function requireStatus(request, allowed, message = '这个要求的状态已经变了，刷新看看') {
  if (!allowed.includes(request.status)) throw fail('CONFLICT', message);
}

function validateRequest(state, p, ctx) {
  const uids = Array.isArray(p.items) ? p.items : [];
  if (uids.length === 0) throw fail('BAD_INPUT', '至少选一道菜');
  const recipes = uids.map((uid) => {
    const r = state.recipes.find((x) => x.uid === uid && !x.archived);
    if (!r) throw fail('BAD_INPUT', '有道菜找不到了');
    return r;
  });
  const servings = Number(p.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) throw fail('BAD_INPUT', '人数要在 1 到 20 之间');
  const wantedDate = String(p.wantedDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wantedDate) || wantedDate < localDate(ctx.now, ctx.tz)) throw fail('BAD_INPUT', '日期不能早于今天');
  if (!MEALS.includes(p.meal)) throw fail('BAD_INPUT', '请选午饭、晚饭或夜宵');
  const wantedTime = String(p.wantedTime ?? '');
  if (wantedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(wantedTime)) throw fail('BAD_INPUT', '时间格式不对');
  const note = String(p.note ?? '').trim();
  if (note.length > 200) throw fail('BAD_INPUT', '备注最多 200 字');
  return { recipes, servings, wantedDate, meal: p.meal, wantedTime, note };
}

register('requests.create', 'any', (state, p, ctx, me) => {
  const v = validateRequest(state, p, ctx);
  const uid = newId(ctx, 'o');
  const selfCook = p.selfCook === true;
  const needs = computeNeeds(v.recipes, v.servings, state.inventory);
  const shortages = computeShortages(needs, state, uid);
  const dishes = v.recipes.map((r) => r.name);
  const w = writer(state);
  for (const s of shortages) {
    if (s.reason === 'unitMismatch') continue;
    w.put('pk_shopping', addShoppingReason(w.state, ctx, {
      name: s.name, inventoryUid: s.inventoryUid, qty: s.qty ?? 1, unit: s.unit,
      reason: { type: 'order', orderUid: uid, dishes, wantedDate: v.wantedDate, meal: v.meal },
    }));
  }
  const request = w.put('pk_orders', {
    uid, userUid: me.uid, takerUid: selfCook ? me.uid : '', items: v.recipes.map((r) => ({ recipeUid: r.uid, name: r.name })),
    servings: v.servings, wantedDate: v.wantedDate, meal: v.meal, wantedTime: v.wantedTime, note: v.note,
    status: selfCook ? 'taken' : 'open', needs, shortages, createdIso: ctx.now, updatedIso: ctx.now,
  });
  const events = state.users
    .filter((u) => u.uid !== me.uid && u.pushToken)
    .map((u) => ({
      type: 'request.created', to: u.pushToken, who: me.name, dishes, servings: request.servings,
      wantedDate: request.wantedDate, meal: request.meal, wantedTime: request.wantedTime, note: request.note,
      shortages: shortages.map((s) => s.name), selfCook,
    }));
  return { writes: w.writes, events };
});

function unwind(w, state, request) {
  for (const s of state.shopping) {
    const next = removeOrderReason(s, request.uid);
    if (next !== s) w.put('pk_shopping', next);
  }
}

register('requests.take', 'any', (state, p, ctx, me) => {
  const r = findRequest(state, p.uid);
  if (r.status === 'taken') throw fail('CONFLICT', `已经有人接了：${nameOf(state, r.takerUid)}`);
  requireStatus(r, ['open']);
  const w = writer();
  w.put('pk_orders', { ...r, status: 'taken', takerUid: me.uid, updatedIso: ctx.now });
  return { writes: w.writes, events: eventTo(state, r.userUid, me.uid, { type: 'request.taken', taker: me.name, dishes: dishNames(r) }) };
});

register('requests.release', 'any', (state, p, ctx, me) => {
  const r = findRequest(state, p.uid);
  requireStatus(r, ['taken']);
  if (r.takerUid !== me.uid) throw fail('FORBIDDEN', '只有接下的人可以说做不了');
  const w = writer();
  w.put('pk_orders', { ...r, status: 'open', takerUid: '', updatedIso: ctx.now });
  return { writes: w.writes, events: eventTo(state, r.userUid, me.uid, { type: 'request.released', taker: me.name, dishes: dishNames(r) }) };
});

register('requests.cancel', 'any', (state, p, ctx, me) => {
  const r = findRequest(state, p.uid);
  if (r.userUid !== me.uid) throw fail('FORBIDDEN', '只能取消自己提的要求');
  requireStatus(r, ['open', 'taken']);
  const w = writer();
  unwind(w, state, r);
  w.put('pk_orders', { ...r, status: 'cancelled', updatedIso: ctx.now });
  return { writes: w.writes, events: eventTo(state, r.takerUid, me.uid, { type: 'request.cancelled', who: me.name, dishes: dishNames(r) }) };
});

register('requests.done', 'any', (state, p, ctx, me) => {
  const r = findRequest(state, p.uid);
  requireStatus(r, ['taken']);
  if (r.takerUid !== me.uid) throw fail('FORBIDDEN', '只有接下的人可以点做好了');
  const w = writer(state);
  const touched = [];
  const needs = r.needs.map((n) => resolveNeed(n, w.state.inventory));
  for (const n of needs) {
    const item = n.inventoryUid && w.state.inventory.find((i) => i.uid === n.inventoryUid);
    if (!item || item.kind !== 'main' || typeof n.qty !== 'number' || n.unitMismatch) continue;
    touched.push(w.put('pk_inventory', { ...item, qty: round1(Math.max(0, item.qty - n.qty)) }));
  }
  w.put('pk_orders', { ...r, needs, status: 'done', updatedIso: ctx.now });
  const events = eventTo(state, r.userUid, me.uid, { type: 'request.done', taker: me.name, dishes: dishNames(r) });
  for (const item of touched) {
    const listed = w.state.shopping.some((s) => s.inventoryUid === item.uid && !s.done && !s.removed);
    if (!lowStockCheck(item) || listed) continue;
    w.put('pk_shopping', addShoppingReason(w.state, ctx, {
      name: item.name, inventoryUid: item.uid, qty: 0, unit: item.unit, reason: { type: 'low' },
    }));
    if (me.pushToken) events.push({ type: 'stock.low', to: me.pushToken, name: item.name });
  }
  return { writes: w.writes, events };
});

export function availability(state) {
  const out = {};
  for (const r of state.recipes) {
    if (r.archived) continue;
    const missing = computeShortages(computeNeeds([r], r.baseServings || 2, state.inventory), state).map((s) => s.name);
    out[r.uid] = { makeable: missing.length === 0, missing };
  }
  return out;
}

export function doneCounts(state) {
  const out = {};
  for (const o of state.orders) {
    if (o.status !== 'done') continue;
    for (const i of o.items) out[i.recipeUid] = (out[i.recipeUid] ?? 0) + 1;
  }
  return out;
}

// Shortages on live requests are recomputed against today's stock, so buying the missing item clears the tag.
function liveRequests(state) {
  return state.orders.map((o) => (o.status === 'open' || o.status === 'taken'
    ? { ...o, shortages: computeShortages(o.needs.map((n) => resolveNeed(n, state.inventory)), state, o.uid) }
    : o));
}

extendView((state) => ({ requests: liveRequests(state), availability: availability(state), doneCounts: doneCounts(state) }));
