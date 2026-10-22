import { test, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { Recipes } from './Recipes.jsx';
import { ApiError } from '../api.js';
import { renderWithApp, makeView } from '../test-utils.jsx';

const pork = {
  uid: 'r1', name: '红烧肉', zone: 'signature', baseServings: 2, archived: false, createdBy: '',
  ingredients: [{ name: '五花肉', qty: 500, unit: 'g', kind: 'main' }, { name: '盐', qty: null, unit: '适量', kind: 'seasoning' }],
  steps: ['焯水', '炖'],
};
const noodles = { uid: 'r2', name: '葱油拌面', zone: 'signature', baseServings: 1, archived: false, ingredients: [], steps: [] };

function view(extra = {}) {
  return makeView('member', { recipes: [noodles, pork], doneCounts: { r1: 3 }, ...extra });
}

test('most cooked dish comes first', () => {
  renderWithApp(<Recipes />, { view: view() });
  expect(screen.getAllByTestId('recipe-name').map((n) => n.textContent)).toEqual(['红烧肉', '葱油拌面']);
  expect(screen.getByText('做过 3 次 · 2 人份')).toBeTruthy();
});

test('new recipe saves and highlights', async () => {
  const { act } = renderWithApp(<Recipes />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '＋ 新菜谱' }));
  fireEvent.input(screen.getByLabelText('菜名'), { target: { value: '番茄炒蛋' } });
  fireEvent.input(screen.getByLabelText('食材（一行一样）'), { target: { value: '番茄 2 个\n盐 适量' } });
  fireEvent.input(screen.getByLabelText('步骤（一行一步）'), { target: { value: '切\n炒' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  const [action, payload, opts] = act.mock.calls[0];
  expect(action).toBe('recipes.save');
  expect(payload).toEqual({ recipe: {
    name: '番茄炒蛋', baseServings: 2, steps: ['切', '炒'],
    ingredients: [{ name: '番茄', qty: 2, unit: '个', kind: 'main' }, { name: '盐', qty: null, unit: '适量', kind: 'seasoning' }],
  } });
  expect(opts.highlight({ recipes: [pork, { uid: 'rNew', name: '番茄炒蛋' }] })).toBe('rNew');
});

test('duplicate name switches to editing the existing dish', async () => {
  const act = vi.fn().mockRejectedValue(new ApiError('CONFLICT', '已经有「红烧肉」了', 409));
  renderWithApp(<Recipes />, { view: view(), act });
  fireEvent.click(screen.getByRole('button', { name: '＋ 新菜谱' }));
  fireEvent.input(screen.getByLabelText('菜名'), { target: { value: ' 红烧肉 ' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText(/已经有「红烧肉」了/)).toBeTruthy();
  expect(screen.getByLabelText('食材（一行一样）').value).toBe('五花肉 500 g\n盐 适量');
});

test('want this opens request sheet preselected', () => {
  renderWithApp(<Recipes />, { view: view() });
  fireEvent.click(screen.getAllByRole('button', { name: '想吃这道' })[0]);
  expect(screen.getByRole('checkbox', { name: /红烧肉/ }).checked).toBe(true);
});

test('detail scales to 4 servings', () => {
  renderWithApp(<Recipes />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '红烧肉' }));
  expect(screen.getByText('五花肉 500 g')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '加一人' }));
  fireEvent.click(screen.getByRole('button', { name: '加一人' }));
  expect(screen.getByText('五花肉 1000 g')).toBeTruthy();
  expect(screen.getByText('盐 适量')).toBeTruthy();
});

test('delete asks to confirm', async () => {
  const { act } = renderWithApp(<Recipes />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '红烧肉' }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(act).not.toHaveBeenCalled();
  expect(screen.getByText('确定删除「红烧肉」？做过的记录会保留。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确定删除' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act.mock.calls[0].slice(0, 2)).toEqual(['recipes.archive', { uid: 'r1' }]);
});
