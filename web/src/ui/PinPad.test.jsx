import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { PinPad } from './PinPad.jsx';

test('pin pad emits 4 digits then submits', () => {
  const onSubmit = vi.fn();
  render(<PinPad onSubmit={onSubmit} />);
  for (const d of '123') fireEvent.click(screen.getByRole('button', { name: d }));
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  expect(onSubmit).toHaveBeenCalledWith('1234');
});

test('backspace removes the last digit', () => {
  const onSubmit = vi.fn();
  render(<PinPad onSubmit={onSubmit} />);
  for (const d of '129') fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  for (const d of '34') fireEvent.click(screen.getByRole('button', { name: d }));
  expect(onSubmit).toHaveBeenCalledWith('1234');
});
