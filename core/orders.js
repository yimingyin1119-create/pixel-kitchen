import { register, fail, writer } from './handle.js';
import { newId } from './ids.js';
import { convert, round1 } from './units.js';
import { localDate } from './time.js';
import { matchIngredient } from './recipes.js';
import { available, lowStockCheck } from './stock.js';
import { addShoppingReason, removeOrderReason } from './shopping.js';
import { extendView } from './view.js';

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
      // Untracked seasonings "to taste" are assumed to be in the cupboard.
      if (n.qty !== null) out.push({ name: n.name, inventoryUid: null, qty: n.qty, unit: n.unit, reason: 'missing' });
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

function chefTokens(state) {
  return state.users.filter((u) => u.role === 'chef' && u.pushToken).map((u) => u.pushToken);
}

function ownerToken(state, order) {
  return state.users.find((u) => u.uid === order.userUid)?.pushToken || null;
}

function dishNames(order) {
  return order.items.map((i) => i.name);
}

function findOrder(state, uid) {
  const o = state.orders.find((x) => x.uid === uid);
  if (!o) throw fail('NOT_FOUND', '找不到这张单');
  return o;
}

function requireStatus(order, allowed) {
  if (!allowed.includes(order.status)) throw fail('CONFLICT', '这张单的状态已经变了，刷新看看');
}

function validateOrder(state, p, ctx) {
  const uids = Array.isArray(p.items) ? p.items : [];
  if (uids.length === 0) throw fail('BAD_INPUT', '至少点一道菜');
  const recipes = uids.map((uid) => {
    const r = state.recipes.find((x) => x.uid === uid && !x.archived);
    if (!r) throw fail('BAD_INPUT', '有道菜找不到了');
    if (r.zone !== 'signature') throw fail('BAD_INPUT', `「${r.name}」还在想吃清单里，厨师学会了才能点`);
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

register('orders.place', 'any', (state, p, ctx, me) => {
  const v = validateOrder(state, p, ctx);
  const uid = newId(ctx, 'o');
  const needs = computeNeeds(v.recipes, v.servings, state.inventory);
  const shortages = computeShortages(needs, state, uid);
  const w = writer(state);
  for (const s of shortages) {
    if (s.reason === 'unitMismatch') continue;
    w.put('pk_shopping', addShoppingReason(w.state, ctx, {
      name: s.name, inventoryUid: s.inventoryUid, qty: s.qty ?? 1, unit: s.unit, reason: { type: 'order', orderUid: uid },
    }));
  }
  const order = w.put('pk_orders', {
    uid, userUid: me.uid, items: v.recipes.map((r) => ({ recipeUid: r.uid, name: r.name })),
    servings: v.servings, wantedDate: v.wantedDate, meal: v.meal, wantedTime: v.wantedTime, note: v.note,
    status: 'pending', rejectReason: '', needs, shortages, createdIso: ctx.now, updatedIso: ctx.now,
  });
  const events = chefTokens(state).map((to) => ({
    type: 'order.placed', to, who: me.name, dishes: dishNames(order), servings: order.servings,
    wantedDate: order.wantedDate, meal: order.meal, wantedTime: order.wantedTime, note: order.note,
    shortages: shortages.map((s) => s.name),
  }));
  return { writes: w.writes, events };
});

function unwind(w, state, order) {
  for (const s of state.shopping) {
    const next = removeOrderReason(s, order.uid);
    if (next !== s) w.put('pk_shopping', next);
  }
}

register('orders.cancel', 'any', (state, p, ctx, me) => {
  const order = findOrder(state, p.uid);
  if (order.userUid !== me.uid) throw fail('FORBIDDEN', '只能取消自己的单');
  requireStatus(order, ['pending']);
  const w = writer();
  unwind(w, state, order);
  w.put('pk_orders', { ...order, status: 'cancelled', updatedIso: ctx.now });
  return { writes: w.writes };
});

register('orders.accept', 'chef', (state, p, ctx) => {
  const order = findOrder(state, p.uid);
  requireStatus(order, ['pending']);
  const w = writer();
  w.put('pk_orders', { ...order, status: 'accepted', updatedIso: ctx.now });
  const to = ownerToken(state, order);
  return { writes: w.writes, events: to ? [{ type: 'order.accepted', to, dishes: dishNames(order) }] : [] };
});

register('orders.reject', 'chef', (state, p, ctx) => {
  const order = findOrder(state, p.uid);
  requireStatus(order, ['pending', 'accepted']);
  const reason = String(p.reason ?? '').trim();
  if (!reason) throw fail('BAD_INPUT', '写一下为什么做不了');
  const w = writer();
  unwind(w, state, order);
  w.put('pk_orders', { ...order, status: 'rejected', rejectReason: reason, updatedIso: ctx.now });
  const to = ownerToken(state, order);
  return { writes: w.writes, events: to ? [{ type: 'order.rejected', to, dishes: dishNames(order), reason }] : [] };
});

register('orders.done', 'chef', (state, p, ctx) => {
  const order = findOrder(state, p.uid);
  requireStatus(order, ['accepted']);
  const w = writer(state);
  const touched = [];
  for (const n of order.needs) {
    const item = n.inventoryUid && w.state.inventory.find((i) => i.uid === n.inventoryUid);
    if (!item || item.kind !== 'main' || typeof n.qty !== 'number' || n.unitMismatch) continue;
    touched.push(w.put('pk_inventory', { ...item, qty: round1(Math.max(0, item.qty - n.qty)) }));
  }
  w.put('pk_orders', { ...order, status: 'done', updatedIso: ctx.now });
  const events = [];
  const owner = ownerToken(state, order);
  if (owner) events.push({ type: 'order.done', to: owner, dishes: dishNames(order) });
  for (const item of touched) {
    const listed = w.state.shopping.some((s) => s.inventoryUid === item.uid && !s.done && !s.removed);
    if (!lowStockCheck(item) || listed) continue;
    w.put('pk_shopping', addShoppingReason(w.state, ctx, {
      name: item.name, inventoryUid: item.uid, qty: 0, unit: item.unit, reason: { type: 'low' },
    }));
    for (const to of chefTokens(state)) events.push({ type: 'stock.low', to, name: item.name });
  }
  return { writes: w.writes, events };
});

export function availability(state) {
  const out = {};
  for (const r of state.recipes) {
    if (r.archived || r.zone !== 'signature') continue;
    const missing = computeShortages(computeNeeds([r], r.baseServings || 2, state.inventory), state).map((s) => s.name);
    out[r.uid] = { makeable: missing.length === 0, missing };
  }
  return out;
}

export function dishCounts(state) {
  const out = {};
  for (const o of state.orders) {
    if (o.status !== 'done') continue;
    for (const i of o.items) out[i.recipeUid] = (out[i.recipeUid] ?? 0) + 1;
  }
  return out;
}

extendView((state) => ({ availability: availability(state), dishCounts: dishCounts(state) }));
