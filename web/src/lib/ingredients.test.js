import { test, expect } from 'vitest';
import { parseIngredientLine, formatIngredientLine } from './ingredients.js';

test('parses ingredient lines', () => {
  expect(parseIngredientLine('五花肉 500 g')).toEqual({ name: '五花肉', qty: 500, unit: 'g', kind: 'main' });
  expect(parseIngredientLine('鸡蛋 2个')).toEqual({ name: '鸡蛋', qty: 2, unit: '个', kind: 'main' });
  expect(parseIngredientLine('盐 适量')).toEqual({ name: '盐', qty: null, unit: '适量', kind: 'seasoning' });
  expect(parseIngredientLine('生抽 1 大勺')).toEqual({ name: '生抽', qty: 1, unit: '大勺', kind: 'seasoning' });
  expect(parseIngredientLine('  ')).toBe(null);
});

test('formats lines back for editing', () => {
  expect(formatIngredientLine({ name: '五花肉', qty: 500, unit: 'g' })).toBe('五花肉 500 g');
  expect(formatIngredientLine({ name: '盐', qty: null, unit: '适量' })).toBe('盐 适量');
  expect(parseIngredientLine(formatIngredientLine({ name: '生抽', qty: 1, unit: '大勺', kind: 'seasoning' })))
    .toEqual({ name: '生抽', qty: 1, unit: '大勺', kind: 'seasoning' });
});

test('lines typed without spaces still split', () => {
  expect(parseIngredientLine('鸡蛋3个')).toEqual({ name: '鸡蛋', qty: 3, unit: '个', kind: 'main' });
  expect(parseIngredientLine('五花肉500g')).toEqual({ name: '五花肉', qty: 500, unit: 'g', kind: 'main' });
  expect(parseIngredientLine('生抽1.5大勺')).toEqual({ name: '生抽', qty: 1.5, unit: '大勺', kind: 'seasoning' });
});

test('a bare name is a main ingredient, unless it is an everyday seasoning', () => {
  expect(parseIngredientLine('鱼')).toEqual({ name: '鱼', qty: null, unit: '', kind: 'main' });
  expect(parseIngredientLine('盐')).toEqual({ name: '盐', qty: null, unit: '适量', kind: 'seasoning' });
  expect(parseIngredientLine('姜少许')).toEqual({ name: '姜', qty: null, unit: '少许', kind: 'seasoning' });
});

test('chinese numbers are understood', () => {
  expect(parseIngredientLine('鱼一条')).toEqual({ name: '鱼', qty: 1, unit: '条', kind: 'main' });
  expect(parseIngredientLine('鸡蛋两个')).toEqual({ name: '鸡蛋', qty: 2, unit: '个', kind: 'main' });
  expect(parseIngredientLine('排骨十二块')).toEqual({ name: '排骨', qty: 12, unit: '块', kind: 'main' });
  expect(parseIngredientLine('半个洋葱')).toEqual({ name: '洋葱', qty: 0.5, unit: '个', kind: 'main' });
  expect(parseIngredientLine('十三香 适量')).toEqual({ name: '十三香', qty: null, unit: '适量', kind: 'seasoning' });
});

test('bare names format back without a unit', () => {
  expect(formatIngredientLine({ name: '鱼', qty: null, unit: '' })).toBe('鱼');
});
