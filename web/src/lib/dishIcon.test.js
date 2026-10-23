import { test, expect } from 'vitest';
import seed from '../../../seed/recipes.json';
import { dishIcon } from './dishIcon.js';

const byName = Object.fromEntries(seed.map((r) => [r.name, r]));

// The approved mockup: every preset dish plus the member-added 红烧鱼.
const EXPECTED = {
  番茄炒蛋: 'egg', 红烧肉: 'meat', 可乐鸡翅: 'chicken', 番茄牛腩: 'meat', 麻婆豆腐: 'tofu', 宫保鸡丁: 'chicken',
  青椒土豆丝: 'leaf', 蒜蓉西兰花: 'leaf', 蛋炒饭: 'rice', 葱油拌面: 'noodles', 紫菜蛋花汤: 'soup', 清炒菜心: 'leaf',
  鱼香肉丝: 'meat', 糖醋排骨: 'meat', 回锅肉: 'meat', 土豆炖牛肉: 'meat', 黄焖鸡: 'chicken', 水煮肉片: 'meat',
  酸菜鱼: 'fish', 清蒸鲈鱼: 'fish', 蚝油生菜: 'leaf', 干煸四季豆: 'leaf', 地三鲜: 'leaf', 韭菜炒蛋: 'egg',
  冬瓜排骨汤: 'soup', 芒果西米露: 'cake', 双皮奶: 'cake', 红豆沙: 'cake', 银耳莲子羹: 'cake', 酒酿小圆子: 'cake',
};

test('every preset dish gets the icon from the approved mockup', () => {
  for (const [name, icon] of Object.entries(EXPECTED)) expect([name, dishIcon(byName[name])]).toEqual([name, icon]);
});

test('a member-added fish dish with only 鱼 as ingredient', () => {
  expect(dishIcon({ name: '红烧鱼', ingredients: [{ name: '鱼', qty: null, unit: '', kind: 'main' }] })).toBe('fish');
});

test('the main ingredient decides when the name says nothing', () => {
  expect(dishIcon({ name: '妈妈的拿手菜', ingredients: [{ name: '三文鱼', qty: 1, unit: '块', kind: 'main' }] })).toBe('fish');
  expect(dishIcon({ name: '神秘料理', ingredients: [] })).toBe('pot');
});
