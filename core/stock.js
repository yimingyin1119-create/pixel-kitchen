import { register, fail, writer } from './handle.js';
import { newId } from './ids.js';
import { convert, normalizeUnit, round1 } from './units.js';
import { matchIngredient } from './recipes.js';
import { sameName } from './names.js';

const OPEN = ['open', 'taken'];

// A need recorded before its ingredient was in stock gets linked to the stock item bought later.
// A link to a deleted (hidden) item is re-resolved by name among the visible ones.
export function resolveNeed(n, inventory) {
  if (n.unitMismatch || typeof n.qty !== 'number') return n;
  if (n.inventoryUid && inventory.some((i) => i.uid === n.inventoryUid && !i.hidden)) return n;
  const item = matchIngredient(n.name, inventory);
  if (!item) return { ...n, inventoryUid: null };
  const qty = convert(n.qty, n.unit, item.unit);
  return qty === null ? { ...n, unitMismatch: true, qty: null } : { ...n, inventoryUid: item.uid, qty: round1(qty), unit: item.unit };
}

// Stock left once every other open request has taken what it needs.
export function available(item, state, exceptRequestUid) {
  let reserved = 0;
  for (const o of state.orders) {
    if (o.uid === exceptRequestUid || !OPEN.includes(o.status)) continue;
    for (const n0 of o.needs ?? []) {
      const n = resolveNeed(n0, state.inventory);
      if (n.inventoryUid === item.uid && typeof n.qty === 'number') reserved += n.qty;
    }
  }
  return round1(item.qty - reserved);
}

export function lowStockCheck(item) {
  return item.kind === 'seasoning' ? item.status !== 'ok' : item.qty <= item.lowThreshold;
}

// Adds bought goods to stock; creates the item when nothing matches. Returns the item and the amount
// added in the item's own unit.
export function stockIn(state, ctx, { inventoryUid, name, qty, unit, expiresOn }) {
  const linked = inventoryUid && state.inventory.find((i) => i.uid === inventoryUid && !i.hidden);
  const item = linked || matchIngredient(name, state.inventory);
  const extra = { stockedIso: ctx.now, ...(expiresOn ? { expiresOn } : {}) };
  if (!item) {
    const base = normalizeUnit(unit);
    const added = round1(qty * base.factor);
    const created = {
      uid: newId(ctx, 'i'), name: String(name).trim(), aliases: [], kind: 'main', qty: added, unit: base.unit,
      lowThreshold: 0, status: 'ok', expiresOn: '', hidden: false, ...extra,
    };
    return { item: created, added };
  }
  if (item.kind === 'seasoning') {
    const added = convert(qty, unit, item.unit) ?? 0;
    return { item: { ...item, ...extra, status: 'ok', qty: round1(item.qty + added) }, added };
  }
  const added = convert(qty, unit || item.unit, item.unit);
  if (added === null) throw fail('BAD_INPUT', `单位对不上：${item.name} 是按 ${item.unit} 记的`);
  return { item: { ...item, ...extra, qty: round1(item.qty + added) }, added };
}

const KINDS = ['main', 'seasoning'];
const STATUSES = ['ok', 'low', 'out'];

register('inventory.save', 'any', (state, p, ctx) => {
  const input = p.item ?? {};
  const existing = input.uid ? state.inventory.find((i) => i.uid === input.uid) : null;
  if (input.uid && !existing) throw fail('NOT_FOUND', '找不到这样食材');
  const name = String(input.name ?? existing?.name ?? '').trim();
  if (!name) throw fail('BAD_INPUT', '食材名不能为空');
  const clash = state.inventory.find((i) => !i.hidden && i.uid !== input.uid && sameName(i.name, name));
  if (clash) throw fail('CONFLICT', `已经有「${clash.name}」了，要改数量就点它`);
  const qty = Number(input.qty ?? existing?.qty ?? 0);
  const lowThreshold = Number(input.lowThreshold ?? existing?.lowThreshold ?? 0);
  if (!(qty >= 0) || !(lowThreshold >= 0)) throw fail('BAD_INPUT', '数量不能是负数');
  const kind = KINDS.includes(input.kind) ? input.kind : existing?.kind ?? 'main';
  const status = STATUSES.includes(input.status) ? input.status : existing?.status ?? 'ok';
  const expiresOn = String(input.expiresOn ?? existing?.expiresOn ?? '');
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) throw fail('BAD_INPUT', '保质期格式不对');
  const w = writer();
  w.put('pk_inventory', {
    ...(existing ?? { uid: newId(ctx, 'i'), stockedIso: ctx.now }),
    name, kind, qty: round1(qty), lowThreshold, status, expiresOn,
    unit: String(input.unit ?? existing?.unit ?? '').trim(),
    aliases: Array.isArray(input.aliases) ? input.aliases.map(String) : existing?.aliases ?? [],
    hidden: false,
  });
  return { writes: w.writes };
});

register('inventory.remove', 'any', (state, p) => {
  const item = state.inventory.find((i) => i.uid === p.uid && !i.hidden);
  if (!item) throw fail('NOT_FOUND', '找不到这样食材');
  const w = writer();
  w.put('pk_inventory', { ...item, hidden: true });
  return { writes: w.writes };
});
