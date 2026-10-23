import { test, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/preact';
import { Today } from './Today.jsx';
import { defaultMeal } from '../ui/RequestSheet.jsx';
import { ApiError } from '../api.js';
import { renderWithApp, makeView } from '../test-utils.jsx';

afterEach(() => vi.useRealTimers());

const me = { uid: 'd1', name: '小明', role: 'member', avatar: '', hasPush: true };
const rq = (uid, userUid, takerUid, status, extra = {}) => ({
  uid, userUid, takerUid, status, items: [{ recipeUid: 'r1', name: `菜${uid}` }], servings: 2,
  wantedDate: '2026-10-23', meal: 'dinner', wantedTime: '', note: '', shortages: [], ...extra,
});

function todayView(requests) {
  return makeView('member', { me, requests });
}

test('sections split by taker and status', () => {
  renderWithApp(<Today />, {
    view: todayView([
      rq('a', 'c1', '', 'open'), rq('b', 'd1', '', 'open'), rq('c', 'c1', 'd1', 'taken'),
      rq('d', 'd1', 'c1', 'taken'), rq('e', 'd1', 'c1', 'done'),
    ]),
  });
  const mine = within(screen.getByTestId('section-mine'));
  const waiting = within(screen.getByTestId('section-waiting'));
  const others = within(screen.getByTestId('section-others'));
  expect(mine.getByText(/菜c/)).toBeTruthy();
  expect(mine.getByRole('button', { name: '做好了' })).toBeTruthy();
  expect(mine.getByRole('button', { name: '做不了' })).toBeTruthy();
  expect(waiting.getByText(/菜a/)).toBeTruthy();
  expect(waiting.getByRole('button', { name: '接下' })).toBeTruthy();
  expect(waiting.getByRole('button', { name: '取消' })).toBeTruthy();
  expect(others.getByText(/大厨 在做/)).toBeTruthy();
  expect(screen.queryByText(/菜e/)).toBe(null);
});

test('take moves card to mine immediately', () => {
  const view = todayView([rq('a', 'c1', '', 'open')]);
  const { act } = renderWithApp(<Today />, { view, act: vi.fn(() => new Promise(() => {})) });
  fireEvent.click(screen.getByRole('button', { name: '接下' }));
  const [action, payload, opts] = act.mock.calls[0];
  expect([action, payload]).toEqual(['requests.take', { uid: 'a' }]);
  const next = opts.optimistic(view);
  expect(next.requests[0]).toMatchObject({ status: 'taken', takerUid: 'd1' });
});

test('take conflict refreshes', async () => {
  const act = vi.fn().mockRejectedValue(new ApiError('CONFLICT', '已经有人接了：大厨', 409));
  const { refresh } = renderWithApp(<Today />, { view: todayView([rq('a', 'c1', '', 'open')]), act });
  fireEvent.click(screen.getByRole('button', { name: '接下' }));
  expect(await screen.findByText('已经有人接了：大厨')).toBeTruthy();
  expect(refresh).toHaveBeenCalled();
});

test('shortage tag links to shopping', () => {
  renderWithApp(<Today />, { view: todayView([rq('c', 'c1', 'd1', 'taken', { shortages: [{ name: '五花肉' }] })]) });
  expect(screen.getByRole('link', { name: '缺：五花肉' }).getAttribute('href')).toBe('#/shopping');
});

test('empty day shows a hint', () => {
  renderWithApp(<Today />, { view: todayView([]) });
  expect(screen.getByText('还没有人提要求，点上面的按钮提一个')).toBeTruthy();
});

test('default meal by hour', () => {
  expect(defaultMeal(10)).toBe('lunch');
  expect(defaultMeal(15)).toBe('dinner');
  expect(defaultMeal(22)).toBe('late');
});

test('request sheet sends structured request with selfCook', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T11:00:00Z')); // 19:00 in Singapore
  const { act } = renderWithApp(<Today />, { view: todayView([]) });
  fireEvent.click(screen.getByRole('button', { name: '提个要求' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /红烧肉/ }));
  fireEvent.click(screen.getByRole('button', { name: '加一人' }));
  fireEvent.click(screen.getByRole('button', { name: '明天' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '我自己来做' }));
  fireEvent.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act.mock.calls[0][0]).toBe('requests.create');
  expect(act.mock.calls[0][1]).toEqual({
    items: ['r1'], servings: 3, wantedDate: '2026-10-24', meal: 'dinner', wantedTime: '', note: '', selfCook: true,
  });
});
