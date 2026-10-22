import { test, expect } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/preact';
import { Shopping } from './Shopping.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';
import { today } from '../lib/time.js';

const item = (uid, name, qty, unit, reasons, extra = {}) => ({
  uid, name, qty, unit, reasons, inventoryUid: '', done: false, boughtQty: 0, doneIso: '', removed: false, ...extra,
});

function view() {
  return makeView('member', {
    shopping: [
      item('s1', '五花肉', 750, 'g', [{ type: 'order', orderUid: 'o1', qty: 750, dishes: ['红烧肉'], wantedDate: today(), meal: 'dinner' }]),
      item('s2', '生抽', 0, '', [{ type: 'low', qty: 0 }]),
      item('s3', '小葱', 1, '把', [{ type: 'manual', qty: 1 }]),
      item('s4', '鸡蛋', 4, '个', [{ type: 'manual', qty: 4 }], { done: true, boughtQty: 6 }),
    ],
  });
}

test('shopping shows dish annotation', () => {
  renderWithApp(<Shopping />, { view: view() });
  const toBuy = within(screen.getByTestId('to-buy'));
  expect(toBuy.getByText('红烧肉 · 今天晚饭')).toBeTruthy();
  expect(toBuy.getByText('快用完了')).toBeTruthy();
  expect(toBuy.getByText('手动加的')).toBeTruthy();
  expect(screen.getByText('还要买 3 样')).toBeTruthy();
});

test('check sheet stocks in and moves item', async () => {
  const v = view();
  const { act } = renderWithApp(<Shopping />, { view: v });
  fireEvent.click(screen.getByRole('checkbox', { name: /五花肉/ }));
  const qty = screen.getByLabelText('买了多少');
  expect(qty.value).toBe('750');
  fireEvent.input(qty, { target: { value: '800' } });
  fireEvent.click(screen.getByRole('button', { name: '存进食材库' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  const [action, payload, opts] = act.mock.calls[0];
  expect([action, payload]).toEqual(['shopping.check', { uid: 's1', boughtQty: 800, unit: 'g' }]);
  expect(opts.optimistic(v).shopping.find((s) => s.uid === 's1').done).toBe(true);
});

test('expiry date is sent when given', async () => {
  const { act } = renderWithApp(<Shopping />, { view: view() });
  fireEvent.click(screen.getByRole('checkbox', { name: /小葱/ }));
  fireEvent.input(screen.getByLabelText('保质期到（可不填）'), { target: { value: '2026-10-30' } });
  fireEvent.click(screen.getByRole('button', { name: '存进食材库' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act.mock.calls[0][1]).toEqual({ uid: 's3', boughtQty: 1, unit: '把', expiresOn: '2026-10-30' });
});

test('uncheck from bought', () => {
  const { act } = renderWithApp(<Shopping />, { view: view() });
  const bought = within(screen.getByTestId('bought'));
  fireEvent.click(bought.getByRole('button', { name: '撤销' }));
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['shopping.uncheck', { uid: 's4' }]);
});

test('manual item can be deleted', () => {
  const { act } = renderWithApp(<Shopping />, { view: view() });
  const toBuy = within(screen.getByTestId('to-buy'));
  expect(toBuy.getAllByRole('button', { name: '删' }).length).toBe(1);
  fireEvent.click(toBuy.getByRole('button', { name: '删' }));
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['shopping.remove', { uid: 's3' }]);
});

test('add a manual item', async () => {
  const { act } = renderWithApp(<Shopping />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '＋ 手动加' }));
  fireEvent.input(screen.getByLabelText('买什么'), { target: { value: '香菜' } });
  fireEvent.input(screen.getByLabelText('数量'), { target: { value: '1' } });
  fireEvent.input(screen.getByLabelText('单位'), { target: { value: '把' } });
  fireEvent.click(screen.getByRole('button', { name: '加进清单' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['shopping.add', { name: '香菜', qty: 1, unit: '把' }]);
});
