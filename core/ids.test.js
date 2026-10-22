import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from './ids.js';

test('ids are unique within one ctx and prefixed', () => {
  const ctx = { now: '2026-10-22T10:00:00Z', rand: 'ab'.repeat(32), seq: 0 };
  const a = newId(ctx, 'o');
  const b = newId(ctx, 'o');
  assert.notEqual(a, b);
  assert.match(a, /^o_/);
});

test('ids are deterministic for the same ctx', () => {
  const mk = () => ({ now: '2026-10-22T10:00:00Z', rand: '0123456789abcdef'.repeat(4), seq: 0 });
  assert.equal(newId(mk(), 'r'), newId(mk(), 'r'));
});
