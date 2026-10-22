// Free-text ingredient lines, as typed in the recipe form.
const SEASONING_UNITS = ['适量', '少许', '大勺', '小勺', '勺', '汤匙', '茶匙'];

// "五花肉 500 g" → { name, qty, unit, kind }
export function parseIngredientLine(line) {
  const text = String(line).trim();
  if (!text) return null;
  // "鸡蛋3个" and "鸡蛋 3 个" both split into name / number / unit; no number means 适量.
  const m = text.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(\S*)\s*$/);
  let name;
  let qty = null;
  let unit;
  if (m && m[1].trim()) {
    name = m[1].trim();
    qty = Number(m[2]);
    unit = m[3];
  } else {
    const [, first, rest = ''] = text.match(/^(\S+)\s*(.*)$/);
    name = first;
    unit = rest.trim() || '适量';
  }
  const kind = qty === null || SEASONING_UNITS.includes(unit) ? 'seasoning' : 'main';
  return { name, qty, unit, kind };
}

export function formatIngredientLine(ing) {
  return [ing.name, ing.qty ?? '', ing.qty === null && ing.unit === '适量' ? '适量' : ing.unit].filter((x) => x !== '').join(' ');
}
