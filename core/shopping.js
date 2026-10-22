import { register, fail, writer } from './handle.js';
import { newId } from './ids.js';
import { convert, round1 } from './units.js';
import { matchIngredient } from './recipes.js';
import { stockIn } from './stock.js';

function isOpen(s) {
  return !s.done && !s.removed;
}

// Merges into the open entry for the same stock item (or same name); returns the row to write.
export function addShoppingReason(state, ctx, { name, inventoryUid, qty, unit, reason }) {
  const same = state.shopping.find(
    (s) => isOpen(s) && (inventoryUid ? s.inventoryUid === inventoryUid : !s.inventoryUid && s.name === name),
  );
  const amount = same ? convert(qty, unit, same.unit) : qty;
  if (same && amount !== null) {
    return { ...same, qty: round1(same.qty + amount), reasons: [...same.reasons, { ...reason, qty: amount }] };
  }
  return {
    uid: newId(ctx, 's'), name, inventoryUid: inventoryUid ?? '', qty: round1(qty), unit,
    reasons: [{ ...reason, qty }], done: false, boughtQty: 0, doneIso: '', removed: false,
  };
}

// Takes back what one order added; an entry with nothing left to justify it disappears.
export function removeOrderReason(shop, orderUid) {
  const mine = shop.reasons.filter((r) => r.type === 'order' && r.orderUid === orderUid);
  if (mine.length === 0) return shop;
  const reasons = shop.reasons.filter((r) => !mine.includes(r));
  const qty = round1(Math.max(0, shop.qty - mine.reduce((t, r) => t + r.qty, 0)));
  return { ...shop, qty, reasons, removed: reasons.length === 0 };
}

function findShop(state, uid) {
  const s = state.shopping.find((x) => x.uid === uid && !x.removed);
  if (!s) throw fail('NOT_FOUND', '采购清单里没有这一项');
  return s;
}

register('shopping.add', 'any', (state, p, ctx) => {
  const name = String(p.name ?? '').trim();
  const qty = Number(p.qty);
  if (!name || !(qty > 0)) throw fail('BAD_INPUT', '要写清楚买什么、买多少');
  const item = matchIngredient(name, state.inventory);
  const w = writer();
  w.put('pk_shopping', addShoppingReason(state, ctx, {
    name: item?.name ?? name, inventoryUid: item?.uid, qty, unit: String(p.unit ?? item?.unit ?? ''),
    reason: { type: 'manual' },
  }));
  return { writes: w.writes };
});

register('shopping.check', 'any', (state, p, ctx) => {
  const shop = findShop(state, p.uid);
  if (shop.done) throw fail('CONFLICT', '这一项已经买过了');
  const bought = Number(p.boughtQty);
  if (!(bought > 0)) throw fail('BAD_INPUT', '买了多少要大于 0');
  const { item, added } = stockIn(state, ctx, {
    inventoryUid: shop.inventoryUid || undefined, name: shop.name, qty: bought,
    unit: p.unit ?? shop.unit, expiresOn: p.expiresOn,
  });
  const w = writer();
  w.put('pk_inventory', item);
  w.put('pk_shopping', { ...shop, inventoryUid: item.uid, unit: item.unit, boughtQty: added, done: true, doneIso: ctx.now });
  return { writes: w.writes };
});

register('shopping.uncheck', 'any', (state, p) => {
  const shop = findShop(state, p.uid);
  if (!shop.done) throw fail('CONFLICT', '这一项还没勾上');
  const item = state.inventory.find((i) => i.uid === shop.inventoryUid);
  const w = writer();
  if (item) w.put('pk_inventory', { ...item, qty: round1(Math.max(0, item.qty - shop.boughtQty)) });
  w.put('pk_shopping', { ...shop, done: false, boughtQty: 0, doneIso: '' });
  return { writes: w.writes };
});

register('shopping.remove', 'any', (state, p) => {
  const shop = findShop(state, p.uid);
  if (shop.reasons.some((r) => r.type !== 'manual')) {
    throw fail('BAD_INPUT', '这一项是为某道菜买的，取消那个要求就会自动去掉');
  }
  const w = writer();
  w.put('pk_shopping', { ...shop, removed: true });
  return { writes: w.writes };
});
