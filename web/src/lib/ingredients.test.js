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
