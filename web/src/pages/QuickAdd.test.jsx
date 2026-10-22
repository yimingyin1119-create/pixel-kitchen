import { test, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { parseIngredientLine, QuickRecipe, QuickStock } from './QuickAdd.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

test('parses ingredient lines', () => {
  expect(parseIngredientLine('五花肉 500 g')).toEqual({ name: '五花肉', qty: 500, unit: 'g', kind: 'main' });
  expect(parseIngredientLine('鸡蛋 2个')).toEqual({ name: '鸡蛋', qty: 2, unit: '个', kind: 'main' });
  expect(parseIngredientLine('盐 适量')).toEqual({ name: '盐', qty: null, unit: '适量', kind: 'seasoning' });
  expect(parseIngredientLine('生抽 1 大勺')).toEqual({ name: '生抽', qty: 1, unit: '大勺', kind: 'seasoning' });
  expect(parseIngredientLine('  ')).toBe(null);
});

test('chef saves a manual recipe', async () => {
  const { act } = renderWithApp(<QuickRecipe />, { view: makeView('chef') });
  fireEvent.input(screen.getByLabelText('菜名'), { target: { value: '番茄炒蛋' } });
  fireEvent.input(screen.getByLabelText('食材（一行一样）'), { target: { value: '番茄 2 个\n鸡蛋 3 个\n盐 适量' } });
  fireEvent.input(screen.getByLabelText('步骤（一行一步）'), { target: { value: '切\n炒' } });
  fireEvent.click(screen.getByRole('button', { name: '存进拿手菜' }));
  await waitFor(() => expect(act).toHaveBeenCalled());
  expect(act).toHaveBeenCalledWith('recipes.save', {
    recipe: {
      name: '番茄炒蛋', baseServings: 2, zone: 'signature', steps: ['切', '炒'],
      ingredients: [
        { name: '番茄', qty: 2, unit: '个', kind: 'main' },
        { name: '鸡蛋', qty: 3, unit: '个', kind: 'main' },
        { name: '盐', qty: null, unit: '适量', kind: 'seasoning' },
      ],
    },
  });
});

test('chef adds a stock item', async () => {
  const { act } = renderWithApp(<QuickStock />, { view: makeView('chef') });
  fireEvent.input(screen.getByLabelText('食材名'), { target: { value: '五花肉' } });
  fireEvent.input(screen.getByLabelText('数量'), { target: { value: '800' } });
  fireEvent.input(screen.getByLabelText('单位'), { target: { value: 'g' } });
  fireEvent.input(screen.getByLabelText('少于多少提醒'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: '加进食材库' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('inventory.save', {
    item: { name: '五花肉', kind: 'main', qty: 800, unit: 'g', lowThreshold: 100, expiresOn: '' },
  }));
});
