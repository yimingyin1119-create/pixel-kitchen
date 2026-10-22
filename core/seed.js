import { newId } from './ids.js';
import { serialize } from './schema.js';
import { normalizeDraft } from './recipes.js';

// Preset dishes written once into an empty recipe table; createdBy '' shows as「预设」.
export function seedRows(ctx, recipes) {
  return recipes.map((r) => {
    const d = normalizeDraft(r, []);
    return serialize('pk_recipes', {
      uid: newId(ctx, 'r'), ...d, ingredients: d.ingredients.map(({ unmatched, ...rest }) => rest),
      zone: 'signature', wishVotes: [], createdBy: '', createdIso: ctx.now, archived: false,
    });
  });
}
