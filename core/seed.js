import { newId } from './ids.js';
import { serialize } from './schema.js';
import { normalizeDraft } from './recipes.js';
import { sameName } from './names.js';

// Preset dishes the table does not have yet (deleted ones count as had); createdBy '' shows as「预设」.
export function seedRows(ctx, recipes, existing = []) {
  return recipes.filter((r) => !existing.some((e) => sameName(e.name, r.name))).map((r) => {
    const d = normalizeDraft(r, []);
    return serialize('pk_recipes', {
      uid: newId(ctx, 'r'), ...d, ingredients: d.ingredients.map(({ unmatched, ...rest }) => rest),
      zone: 'signature', wishVotes: [], createdBy: '', createdIso: ctx.now, archived: false,
    });
  });
}
