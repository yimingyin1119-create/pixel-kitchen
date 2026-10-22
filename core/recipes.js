import { register, fail, writer } from './handle.js';
import { newId } from './ids.js';
import { convert, normalizeUnit } from './units.js';
import { sameName } from './names.js';

const MODIFIERS = ['新鲜', '切片', '切段', '切丝', '去皮', '适量', '少许'];

function bare(name) {
  let n = String(name ?? '').trim();
  for (const m of MODIFIERS) n = n.split(m).join('');
  return n.trim();
}

export function matchIngredient(name, allInventory) {
  const inventory = allInventory.filter((i) => !i.hidden);
  const n = String(name ?? '').trim();
  const b = bare(n);
  return (
    inventory.find((i) => i.name === n) ??
    inventory.find((i) => (i.aliases ?? []).includes(n)) ??
    inventory.find((i) => bare(i.name) === b || (i.aliases ?? []).some((a) => bare(a) === b)) ??
    null
  );
}

function cleanIngredient(ing, inventory) {
  const name = String(ing.name ?? '').trim();
  const kind = ing.kind === 'seasoning' ? 'seasoning' : 'main';
  const item = matchIngredient(name, inventory);
  let qty = typeof ing.qty === 'number' && ing.qty > 0 ? ing.qty : null;
  let unit = String(ing.unit ?? '').trim();
  if (qty !== null) {
    const toStock = item ? convert(qty, unit, item.unit) : null;
    if (toStock !== null) {
      qty = toStock;
      unit = item.unit;
    } else {
      const base = normalizeUnit(unit);
      qty = qty * base.factor;
      unit = base.unit;
    }
  }
  return { name, qty, unit, kind, inventoryUid: item ? item.uid : null, unmatched: !item };
}

export function normalizeDraft(ai, inventory) {
  return {
    name: String(ai.name ?? '').trim(),
    baseServings: Number(ai.baseServings) > 0 ? Number(ai.baseServings) : 2,
    imageUrl: ai.imageUrl ?? '',
    sourceUrl: ai.sourceUrl ?? '',
    ingredients: (ai.ingredients ?? []).filter((i) => i && i.name).map((i) => cleanIngredient(i, inventory)),
    steps: (ai.steps ?? []).map(String),
    tags: (ai.tags ?? []).map(String),
  };
}

function findRecipe(state, uid) {
  const r = state.recipes.find((x) => x.uid === uid);
  if (!r) throw fail('NOT_FOUND', '找不到这道菜');
  return r;
}

register('recipes.save', 'any', (state, p, ctx, me) => {
  const input = p.recipe ?? {};
  const existing = input.uid ? findRecipe(state, input.uid) : null;
  const d = normalizeDraft(input, state.inventory);
  if (!d.name) throw fail('BAD_INPUT', '菜名不能为空');
  const clash = state.recipes.find((r) => !r.archived && r.uid !== input.uid && sameName(r.name, d.name));
  if (clash) throw fail('CONFLICT', `已经有「${clash.name}」了`);
  const ingredients = d.ingredients.map(({ unmatched, ...rest }) => rest);
  const w = writer();
  w.put('pk_recipes', {
    ...(existing ?? { uid: newId(ctx, 'r'), wishVotes: [], createdBy: me.uid, createdIso: ctx.now, archived: false }),
    ...d,
    ingredients,
    zone: 'signature',
  });
  return { writes: w.writes };
});

register('recipes.archive', 'any', (state, p) => {
  const w = writer();
  w.put('pk_recipes', { ...findRecipe(state, p.uid), archived: true });
  return { writes: w.writes };
});
