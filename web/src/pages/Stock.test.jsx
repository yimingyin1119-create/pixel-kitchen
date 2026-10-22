import { test, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { Stock } from './Stock.jsx';
import { ApiError } from '../api.js';
import { renderWithApp, makeView } from '../test-utils.jsx';
import { today, addDays } from '../lib/time.js';

const inv = (uid, name, kind, qty, unit, extra = {}) => ({
  uid, name, kind, qty, unit, lowThreshold: 0, status: 'ok', expiresOn: '', aliases: [], hidden: false,
  stockedIso: '2026-10-20T00:00:00.000Z', ...extra,
});

function view() {
  return makeView('member', {
    inventory: [
      inv('i1', '五花肉', 'main', 600, 'g', { lowThreshold: 100, stockedIso: '2026-10-21T00:00:00.000Z' }),
      inv('i2', '生抽', 'seasoning', 0, ''),
      inv('i3', '小白菜', 'main', 1, '把', { expiresOn: addDays(today(), 1), stockedIso: '2026-10-22T00:00:00.000Z' }),
    ],
  });
}

test('newest stock comes first', () => {
  renderWithApp(<Stock />, { view: view() });
  expect(screen.getAllByTestId('stock-name').map((n) => n.textContent)).toEqual(['小白菜', '五花肉', '生抽']);
});

test('new stock item is saved and flashed', async () => {
  const { act } = renderWithApp(<Stock />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '＋ 加食材' }));
  fireEvent.input(screen.getByLabelText('食材名'), { target: { value: '鸡蛋' } });
  fireEvent.input(screen.getByLabelText('数量'), { target: { value: '6' } });
  fireEvent.input(screen.getByLabelText('单位'), { target: { value: '个' } });
  fireEvent.input(screen.getByLabelText('少于多少提醒'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  const [action, payload, opts] = act.mock.calls[0];
  expect([action, payload]).toEqual(['inventory.save', { item: { name: '鸡蛋', kind: 'main', qty: 6, unit: '个', lowThreshold: 2, expiresOn: '' } }]);
  expect(opts.highlight({ inventory: [...view().inventory, inv('i9', '鸡蛋', 'main', 6, '个')] })).toBe('i9');
});

test('highlighted item flashes', () => {
  renderWithApp(<Stock />, { view: view(), highlight: 'i1' });
  expect(screen.getByTestId('stock-i1').className).toContain('flash');
});

test('duplicate opens existing item', async () => {
  const act = vi.fn().mockRejectedValue(new ApiError('CONFLICT', '已经有「五花肉」了，要改数量就点它', 409));
  renderWithApp(<Stock />, { view: view(), act });
  fireEvent.click(screen.getByRole('button', { name: '＋ 加食材' }));
  fireEvent.input(screen.getByLabelText('食材名'), { target: { value: '五花肉 ' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText(/已经有「五花肉」了/)).toBeTruthy();
  expect(screen.getByLabelText('数量').value).toBe('600');
});

test('seasoning status cycles', () => {
  const { act } = renderWithApp(<Stock />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '生抽：有' }));
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['inventory.save', { item: { uid: 'i2', status: 'low' } }]);
});

test('expiring tag within 3 days', () => {
  renderWithApp(<Stock />, { view: view() });
  expect(screen.getByText('还剩 1 天')).toBeTruthy();
});

test('edit and delete an item', async () => {
  const { act } = renderWithApp(<Stock />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '五花肉' }));
  expect(screen.getByLabelText('数量').value).toBe('600');
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(screen.getByRole('button', { name: '确定删除' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['inventory.remove', { uid: 'i1' }]);
});
