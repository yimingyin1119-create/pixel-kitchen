// Recipe and stock quantities are compared in a small set of base units: g, ml, 个.
const ALIASES = {
  g: ['g', '克'],
  kg: ['kg', '公斤', '千克'],
  jin: ['斤'],
  liang: ['两'],
  ml: ['ml', '毫升'],
  l: ['l', 'L', '升'],
  piece: ['个', '只', '颗', '枚', '根'],
  tbsp: ['汤匙', '大勺'],
  tsp: ['茶匙', '小勺'],
};

const BASE = {
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  jin: { unit: 'g', factor: 500 },
  liang: { unit: 'g', factor: 50 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  piece: { unit: '个', factor: 1 },
  tbsp: { unit: 'ml', factor: 15 },
  tsp: { unit: 'ml', factor: 5 },
};

const LOOKUP = new Map();
for (const [key, names] of Object.entries(ALIASES)) for (const n of names) LOOKUP.set(n, BASE[key]);

export function normalizeUnit(u) {
  const name = String(u ?? '').trim();
  return LOOKUP.get(name) ?? LOOKUP.get(name.toLowerCase()) ?? { unit: name, factor: 1 };
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// Returns null when the two units measure different things (e.g. 个 vs g).
export function convert(qty, from, to) {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (a.unit !== b.unit) return null;
  return round1((qty * a.factor) / b.factor);
}
