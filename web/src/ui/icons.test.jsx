import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { TabBar } from './TabBar.jsx';
import { Header } from './Header.jsx';
import { Sprite } from './Sprite.jsx';
import { SPRITES } from './sprites.js';

test('every tab shows a pixel icon above its label', () => {
  render(<TabBar current="today" onSelect={() => {}} />);
  const icons = screen.getAllByRole('tab').map((t) => t.querySelector('[data-icon]')?.dataset.icon);
  expect(icons).toEqual(['pot', 'book', 'cart', 'fridge', 'hat']);
});

test('the header can carry an icon', () => {
  const { container } = render(<Header title="搭伙小灶" subtitle="今天" icon="hat" />);
  expect(container.querySelector('header [data-icon="hat"] svg')).toBeTruthy();
});

test('all icons from the mockup exist', () => {
  for (const name of ['hat', 'pot', 'book', 'cart', 'fridge', 'bell', 'clock', 'scroll', 'cake', 'fish', 'soup', 'noodles', 'rice', 'chicken', 'meat', 'tofu', 'egg', 'tomato', 'leaf', 'cat']) {
    expect(SPRITES[name], name).toBeTruthy();
    const widths = new Set(SPRITES[name].map((row) => row.length));
    expect(widths.size, `${name} rows must be equal width`).toBe(1);
  }
});

test('a tinted sprite draws every pixel in one colour', () => {
  const { container } = render(<Sprite name="pot" tint="#fff6e6" />);
  const fills = new Set([...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill')));
  expect([...fills]).toEqual(['#fff6e6']);
});
