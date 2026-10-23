// Free-text ingredient lines, as typed in the recipe form.
import { isPantryName } from '../../../core/pantry.js';

const SEASONING_UNITS = ['适量', '少许', '大勺', '小勺', '勺', '汤匙', '茶匙'];
const CN = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const NUM = '\\d+(?:\\.\\d+)?|半|[一二两三四五六七八九十]+';
const UNIT = '大勺|小勺|汤匙|茶匙|[个条根把颗片块勺碗盒袋瓶只斤克朵罐杯包]|g|kg|ml|L';

// "3" / "两" / "十二" / "半" → number; anything else → null.
function toNumber(s) {
  if (/^\d/.test(s)) return Number(s);
  if (s === '半') return 0.5;
  if (!/^[一二两三四五六七八九十]+$/.test(s)) return null;
  if (!s.includes('十')) return s.length === 1 ? CN[s] : null;
  const [tens, ones] = s.split('十');
  return (tens ? CN[tens] : 1) * 10 + (ones ? CN[ones] : 0);
}

function kindOf(name, qty, unit) {
  if (SEASONING_UNITS.includes(unit)) return 'seasoning';
  if (qty === null && isPantryName(name)) return 'seasoning';
  return 'main';
}

// "五花肉 500 g", "鸡蛋3个", "鱼一条", "半个洋葱", "鱼" → { name, qty, unit, kind }
export function parseIngredientLine(line) {
  const text = String(line).trim();
  if (!text) return null;
  const prefix = text.match(new RegExp(`^(${NUM})\\s*(${UNIT})\\s*(\\S.*)$`));
  if (prefix && toNumber(prefix[1]) !== null) {
    const qty = toNumber(prefix[1]);
    return { name: prefix[3].trim(), qty, unit: prefix[2], kind: kindOf(prefix[3], qty, prefix[2]) };
  }
  const suffix = text.match(new RegExp(`^(.+?)\\s*(${NUM})\\s*(\\S*)\\s*$`));
  if (suffix && suffix[1].trim() && toNumber(suffix[2]) !== null) {
    const qty = toNumber(suffix[2]);
    return { name: suffix[1].trim(), qty, unit: suffix[3], kind: kindOf(suffix[1], qty, suffix[3]) };
  }
  const bare = text.match(/^(\S+?)\s*(适量|少许)?\s*$/) ?? text.match(/^(\S+)\s*(.*)$/);
  const first = bare[1];
  const rest = bare[2] ?? '';
  const unit = rest.trim() || (isPantryName(first) ? '适量' : '');
  return { name: first, qty: null, unit, kind: kindOf(first, null, unit) };
}

export function formatIngredientLine(ing) {
  return [ing.name, ing.qty ?? '', ing.unit].filter((x) => x !== '' && x !== undefined).join(' ');
}
