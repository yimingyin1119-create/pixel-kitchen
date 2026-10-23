import { test, expect } from 'vitest';
import { screen } from '@testing-library/preact';
import { History } from './History.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

const me = { uid: 'u1', name: '小明', role: 'member', avatar: '', hasPush: true };
const users = [{ uid: 'u1', name: '小明' }, { uid: 'u2', name: '小红' }];
const done = (uid, wantedDate, meal, updatedIso, userUid, takerUid, names, servings = 2) => ({
  uid, wantedDate, meal, updatedIso, userUid, takerUid, servings, status: 'done', wantedTime: '', note: '', shortages: [],
  items: names.map((n, i) => ({ recipeUid: `r${i}`, name: n })),
});

function view(requests) {
  return makeView('member', { me, users, requests });
}

test('groups finished meals by day, newest first', () => {
  renderWithApp(<History />, {
    view: view([
      done('o3', '2026-10-20', 'dinner', '2026-10-20T11:05:00.000Z', 'u1', 'u2', ['红烧鱼']),
      done('o1', '2026-10-22', 'dinner', '2026-10-22T11:40:00.000Z', 'u1', 'u2', ['红烧肉', '清炒菜心'], 3),
      done('o2', '2026-10-22', 'late', '2026-10-22T14:15:00.000Z', 'u2', 'u2', ['芒果西米露']),
      { ...done('o4', '2026-10-23', 'lunch', '2026-10-23T03:00:00.000Z', 'u1', '', ['蛋炒饭']), status: 'open' },
    ]),
  });
  expect(screen.getByText('一共做了 3 顿')).toBeTruthy();
  expect(screen.getAllByTestId('history-day').map((d) => d.textContent)).toEqual(['10月22日 周四', '10月20日 周二']);
  const meals = screen.getAllByTestId('history-meal').map((m) => m.textContent);
  expect(meals[0]).toContain('夜宵 · 22:15 做好');
  expect(meals[0]).toContain('芒果西米露');
  expect(meals[0]).toContain('小红自己做 · 2 人');
  expect(meals[1]).toContain('晚饭 · 19:40 做好');
  expect(meals[1]).toContain('红烧肉、清炒菜心');
  expect(meals[1]).toContain('小明提 · 小红做 · 3 人');
  expect(screen.queryByText('蛋炒饭')).toBe(null);
});

test('empty history', () => {
  renderWithApp(<History />, { view: view([]) });
  expect(screen.getByText('还没有做过饭，做好的每一顿都会记在这里')).toBeTruthy();
});
