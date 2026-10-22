// Free-text ingredient lines, as typed in the recipe form.
const SEASONING_UNITS = ['适量', '少许', '大勺', '小勺', '勺', '汤匙', '茶匙'];

// "五花肉 500 g" → { name, qty, unit, kind }
export function parseIngredientLine(line) {
  const text = String(line).trim();
  if (!text) return null;
  const [, name, rest = ''] = text.match(/^(\S+)\s*(.*)$/);
  const m = rest.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  const qty = m ? Number(m[1]) : null;
  const unit = (m ? m[2] : rest).trim() || (qty === null ? '适量' : '');
  const kind = qty === null || SEASONING_UNITS.includes(unit) ? 'seasoning' : 'main';
  return { name, qty, unit, kind };
}

export function formatIngredientLine(ing) {
  return [ing.name, ing.qty ?? '', ing.qty === null && ing.unit === '适量' ? '适量' : ing.unit].filter((x) => x !== '').join(' ');
}
