import { test, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { ChefQueue } from './ChefQueue.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

const order = (uid, wantedDate, meal, status = 'pending', extra = {}) => ({
  uid, userUid: 'd1', items: [{ recipeUid: 'r1', name: '红烧肉' }], servings: 2, wantedDate, meal, wantedTime: '',
  note: '', status, shortages: [], ...extra,
});

function chefWith(orders) {
  return makeView('chef', { orders });
}

test('chef queue groups by meal', () => {
  renderWithApp(<ChefQueue />, {
    view: chefWith([order('o1', '2026-10-23', 'dinner'), order('o2', '2026-10-23', 'dinner'), order('o3', '2026-10-24', 'lunch')]),
  });
  const headers = screen.getAllByTestId('meal-group').map((h) => h.textContent);
  expect(headers).toEqual(['10月23日 晚饭 · 2 单', '10月24日 午饭 · 1 单']);
});

test('only open orders are listed', () => {
  renderWithApp(<ChefQueue />, { view: chefWith([order('o1', '2026-10-23', 'dinner', 'done')]) });
  expect(screen.getByText('现在没有待处理的订单')).toBeTruthy();
});

test('shows who ordered, note and shortages', () => {
  renderWithApp(<ChefQueue />, {
    view: chefWith([order('o1', '2026-10-23', 'dinner', 'pending', { note: '少辣', shortages: [{ name: '五花肉' }] })]),
  });
  expect(screen.getByText(/小明/)).toBeTruthy();
  expect(screen.getByText('备注：少辣')).toBeTruthy();
  expect(screen.getByText('缺：五花肉')).toBeTruthy();
});

test('accept and done call actions', () => {
  const { act } = renderWithApp(<ChefQueue />, {
    view: chefWith([order('o1', '2026-10-23', 'dinner'), order('o2', '2026-10-23', 'dinner', 'accepted')]),
  });
  fireEvent.click(screen.getByRole('button', { name: '接单' }));
  expect(act).toHaveBeenCalledWith('orders.accept', { uid: 'o1' });
  fireEvent.click(screen.getByRole('button', { name: '做好了' }));
  expect(act).toHaveBeenCalledWith('orders.done', { uid: 'o2' });
});

test('chef reject requires reason', async () => {
  const { act } = renderWithApp(<ChefQueue />, { view: chefWith([order('o1', '2026-10-23', 'dinner')]) });
  fireEvent.click(screen.getByRole('button', { name: '拒单' }));
  fireEvent.click(screen.getByRole('button', { name: '确定拒单' }));
  expect(act).not.toHaveBeenCalled();
  expect(screen.getByText('写一下为什么做不了')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '缺料' }));
  fireEvent.click(screen.getByRole('button', { name: '确定拒单' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('orders.reject', { uid: 'o1', reason: '缺料' }));
});
