import { test, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { Order } from './Order.jsx';
import { defaultMeal } from '../ui/Checkout.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

afterEach(() => vi.useRealTimers());

test('wish recipes not orderable', () => {
  renderWithApp(<Order />);
  expect(screen.getByText('红烧肉')).toBeTruthy();
  expect(screen.queryByText('佛跳墙')).toBe(null);
});

test('shows counts and missing ingredients', () => {
  renderWithApp(<Order />);
  expect(screen.getByText('点过 3 次')).toBeTruthy();
  expect(screen.getByText('缺：小葱')).toBeTruthy();
});

test('most ordered dish comes first', () => {
  renderWithApp(<Order />, { view: makeView('diner', { dishCounts: { r2: 5, r1: 1 } }) });
  const names = screen.getAllByTestId('dish-name').map((n) => n.textContent);
  expect(names).toEqual(['葱油拌面', '红烧肉']);
});

test('cart survives reload', () => {
  const first = renderWithApp(<Order />);
  fireEvent.click(screen.getAllByRole('button', { name: '点这道' })[0]);
  expect(screen.getByText('已选 1 道')).toBeTruthy();
  first.unmount();
  renderWithApp(<Order />);
  expect(screen.getByText('已选 1 道')).toBeTruthy();
});

test('default meal by hour', () => {
  expect(defaultMeal(10)).toBe('lunch');
  expect(defaultMeal(15)).toBe('dinner');
  expect(defaultMeal(22)).toBe('late');
});

test('checkout sends structured time', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T11:00:00Z')); // 19:00 in Singapore
  const { act } = renderWithApp(<Order />);
  fireEvent.click(screen.getAllByRole('button', { name: '点这道' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '去下单' }));
  fireEvent.click(screen.getByRole('button', { name: '加一人' }));
  fireEvent.click(screen.getByRole('button', { name: '明天' }));
  fireEvent.input(screen.getByLabelText('具体时间（可不填）'), { target: { value: '19:30' } });
  fireEvent.input(screen.getByLabelText('备注'), { target: { value: '少辣' } });
  fireEvent.click(screen.getByRole('button', { name: '下单' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act).toHaveBeenCalledWith('orders.place', {
    items: ['r1'], servings: 3, wantedDate: '2026-10-24', meal: 'dinner', wantedTime: '19:30', note: '少辣',
  });
});

test('cart clears after a successful order', async () => {
  renderWithApp(<Order />);
  fireEvent.click(screen.getAllByRole('button', { name: '点这道' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '去下单' }));
  fireEvent.click(screen.getByRole('button', { name: '下单' }));
  expect(await screen.findByText(/下单成功，等厨师接单/)).toBeTruthy();
  expect(screen.queryByText('已选 1 道')).toBe(null);
});
