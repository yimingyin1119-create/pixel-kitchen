import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from './app.jsx';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function viewFor(role) {
  return {
    me: { uid: 'u1', name: role === 'chef' ? '大厨' : '小明', role, avatar: '', hasPush: false },
    users: [], recipes: [], orders: [], availability: {}, dishCounts: {},
    ...(role === 'chef' ? { inventory: [], shopping: [] } : {}),
  };
}

function loggedIn() {
  localStorage.setItem('pk.token', 'tok');
}

test('login screen when there is no token', () => {
  render(<App />);
  expect(screen.getByPlaceholderText('你的名字')).toBeTruthy();
});

test('offline screen on network error', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  render(<App />);
  expect(await screen.findByText('厨房打烊了')).toBeTruthy();
  expect(screen.getByRole('button', { name: '再试一次' })).toBeTruthy();
});

test('chef sees five tabs, diner three', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: viewFor('chef') }));
  const { unmount } = render(<App />);
  await waitFor(() => expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['点菜', '菜谱', '采购', '食材库', '我的']));
  unmount();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: viewFor('diner') }));
  render(<App />);
  await waitFor(() => expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['点菜', '菜谱', '我的']));
});

test('401 returns to login', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401));
  render(<App />);
  expect(await screen.findByPlaceholderText('你的名字')).toBeTruthy();
  expect(localStorage.getItem('pk.token')).toBe(null);
});

test('no users yet leads to chef setup', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: false, error: { code: 'NO_USERS', message: '还没有任何账号' } }, 404));
  render(<App />);
  fireEvent.input(screen.getByPlaceholderText('你的名字'), { target: { value: '大厨' } });
  for (const d of '1234') fireEvent.click(screen.getByRole('button', { name: d }));
  expect(await screen.findByText('建一个厨师账号')).toBeTruthy();
});

test('successful login stores the token and shows the app', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: { token: 'new-tok', view: viewFor('diner') } }));
  render(<App />);
  fireEvent.input(screen.getByPlaceholderText('你的名字'), { target: { value: '小明' } });
  for (const d of '5678') fireEvent.click(screen.getByRole('button', { name: d }));
  await waitFor(() => expect(screen.getAllByRole('tab').length).toBe(3));
  expect(localStorage.getItem('pk.token')).toBe('new-tok');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ action: 'auth.login', payload: { name: '小明', pin: '5678' } });
});
