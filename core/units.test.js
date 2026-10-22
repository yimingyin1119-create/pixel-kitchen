import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, normalizeUnit, round1 } from './units.js';

test('jin converts to grams', () => assert.equal(convert(1, '斤', 'g'), 500));
test('kg converts to 克', () => assert.equal(convert(1.5, 'kg', '克'), 1500));
test('tablespoons convert to ml', () => assert.equal(convert(2, '大勺', 'ml'), 30));
test('pieces cannot convert to grams', () => assert.equal(convert(2, '个', 'g'), null));
test('unknown units only convert to themselves', () => {
  assert.equal(convert(3, '把', '把'), 3);
  assert.equal(convert(3, '把', 'g'), null);
});
test('normalizeUnit maps aliases', () => {
  assert.deepEqual(normalizeUnit('颗'), { unit: '个', factor: 1 });
  assert.deepEqual(normalizeUnit('两'), { unit: 'g', factor: 50 });
});
test('round1 keeps one decimal', () => assert.equal(round1(1.26), 1.3));
