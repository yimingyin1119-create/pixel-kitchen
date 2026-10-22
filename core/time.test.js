import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, localTime, daysUntil } from './time.js';

test('localDate uses Amsterdam time', () =>
  assert.equal(localDate('2026-10-22T23:30:00Z', 'Europe/Amsterdam'), '2026-10-23'));
test('localTime is HH:MM', () =>
  assert.equal(localTime('2026-10-22T19:05:00Z', 'Europe/Amsterdam'), '21:05'));
test('daysUntil counts calendar days', () => {
  assert.equal(daysUntil('2026-10-25', '2026-10-22'), 3);
  assert.equal(daysUntil('2026-10-21', '2026-10-22'), -1);
});
