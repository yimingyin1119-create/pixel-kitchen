import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { App } from './app.jsx';
import { useApp } from './store.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function view(name = '小明', extra = {}) {
  return {
    me: { uid: 'u1', name, role: 'member', avatar: '', hasPush: false },
    users: [], recipes: [], requests: [], inventory: [], shopping: [], availability: {}, doneCounts: {}, ...extra,
  };
}

function loggedIn(token = 'tokA0000xyz', cached) {
  localStorage.setItem('pk.token', token);
  if (cached) localStorage.setItem(`pk.view.${token.slice(0, 8)}`, JSON.stringify(cached));
}

test('login screen when there is no token', () => {
  render(<App />);
  expect(screen.getByPlaceholderText('你的名字')).toBeTruthy();
  expect(screen.getByText('欢迎回来')).toBeTruthy();
});

test('offline screen on network error', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  render(<App />);
  expect(await screen.findByText('厨房打烊了')).toBeTruthy();
});

test('five tabs for everyone', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: view() }));
  render(<App />);
  await waitFor(() => expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['今天', '菜谱', '采购', '食材', '我的']));
});

test('401 returns to login and clears the cache', async () => {
  loggedIn('tokA0000xyz', view());
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401));
  render(<App />);
  expect(await screen.findByPlaceholderText('你的名字')).toBeTruthy();
  expect(localStorage.getItem('pk.token')).toBe(null);
  expect(localStorage.getItem('pk.view.tokA0000')).toBe(null);
});

test('register mode calls auth.register', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: { token: 'newtok123', view: view('小红') } }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '第一次来？注册' }));
  expect(screen.getByText('加入饭搭子')).toBeTruthy();
  fireEvent.input(screen.getByPlaceholderText('你的名字'), { target: { value: '小红' } });
  for (const d of '2468') fireEvent.click(screen.getByRole('button', { name: d }));
  await waitFor(() => expect(screen.getAllByRole('tab').length).toBe(5));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ action: 'auth.register', payload: { name: '小红', pin: '2468' } });
  expect(localStorage.getItem('pk.token')).toBe('newtok123');
});

test('cached view shows instantly then refreshes', async () => {
  loggedIn('tokA0000xyz', view('缓存里的名字'));
  let resolve;
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<App />);
  window.location.hash = '#/me';
  expect(screen.getAllByRole('tab').length).toBe(5);
  expect(screen.queryByText('正在开火……')).toBe(null);
  expect(screen.getByText('同步中')).toBeTruthy();
  resolve(json({ ok: true, data: view('服务器上的名字') }));
  await waitFor(() => expect(screen.queryByText('同步中')).toBe(null));
  expect(JSON.parse(localStorage.getItem('pk.view.tokA0000')).me.name).toBe('服务器上的名字');
});

test('cache is per account and cleared on sign out', async () => {
  loggedIn('tokA0000xyz', view('小明'));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: view('小明') }));
  render(<App />);
  window.location.hash = '#/me';
  await waitFor(() => expect(screen.queryByText('同步中')).toBe(null));
  fireEvent.click(await screen.findByRole('button', { name: '退出登录' }));
  expect(await screen.findByPlaceholderText('你的名字')).toBeTruthy();
  expect(localStorage.getItem('pk.view.tokA0000')).toBe(null);
});

function Renamer() {
  const { view: v, act } = useApp();
  const [msg, setMsg] = useState('');
  const go = () => act('me.update', { avatar: 'x' }, { optimistic: (cur) => ({ ...cur, me: { ...cur.me, name: '改了' } }) })
    .catch((e) => setMsg(e.message));
  return <div><span data-testid="name">{v.me.name}</span><button type="button" onClick={go}>改名</button><p>{msg}</p></div>;
}

test('optimistic change reverts on error', async () => {
  const { AppProvider } = await import('./app.jsx');
  let reject;
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => { reject = r; }));
  loggedIn('tokA0000xyz', view('小明'));
  render(<AppProvider><Renamer /></AppProvider>);
  reject(json({ ok: true, data: view('小明') }));
  await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('小明'));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: false, error: { code: 'CONFLICT', message: '已经有人叫这个名字了' } }, 409));
  fireEvent.click(screen.getByRole('button', { name: '改名' }));
  expect(screen.getByTestId('name').textContent).toBe('改了');
  expect(await screen.findByText('已经有人叫这个名字了')).toBeTruthy();
  expect(screen.getByTestId('name').textContent).toBe('小明');
});

test('brand name everywhere', () => {
  render(<App />);
  expect(screen.getAllByText('饭搭子').length).toBeGreaterThan(0);
  expect(screen.getByText('一起开小灶')).toBeTruthy();
  expect(document.body.textContent).not.toContain('乡村小厨');
});

function TwoActions() {
  const { view: v, act } = useApp();
  const [msg, setMsg] = useState('');
  const run = (tag) => act('me.update', { avatar: tag }, { optimistic: (cur) => ({ ...cur, me: { ...cur.me, name: `${tag}的猜测` } }) })
    .catch((e) => setMsg(e.message));
  return <div><span data-testid="name">{v.me.name}</span><button type="button" onClick={() => run('a')}>A</button><button type="button" onClick={() => run('b')}>B</button><p>{msg}</p></div>;
}

test('a failed action restores the last confirmed view, not an older snapshot', async () => {
  const { AppProvider } = await import('./app.jsx');
  loggedIn('tokA0000xyz', view('小明'));
  let failA;
  let serverName = '小明';
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.action === 'me.update' && body.payload.avatar === 'a') return new Promise((r) => { failA = r; });
    if (body.action === 'me.update') serverName = 'B已确认';
    return json({ ok: true, data: view(serverName) });
  });
  render(<AppProvider><TwoActions /></AppProvider>);
  await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('小明'));
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  fireEvent.click(screen.getByRole('button', { name: 'B' }));
  await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('B已确认'));
  failA(json({ ok: false, error: { code: 'CONFLICT', message: '状态变了' } }, 409));
  expect(await screen.findByText('状态变了')).toBeTruthy();
  expect(screen.getByTestId('name').textContent).toBe('B已确认');
});

function Switcher() {
  const { view: v, act, signOut, signedIn } = useApp();
  return (
    <div>
      <span data-testid="name">{v?.me?.name ?? '无'}</span>
      <button type="button" onClick={() => act('me.update', { avatar: 'slow' }).catch(() => {})}>慢请求</button>
      <button type="button" onClick={() => { signOut(); signedIn('tokB0000xyz', view('小红')); }}>换人</button>
    </div>
  );
}

test('a late response after switching accounts is dropped', async () => {
  const { AppProvider } = await import('./app.jsx');
  loggedIn('tokA0000xyz', view('小明'));
  let slow;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.payload?.avatar === 'slow') return new Promise((r) => { slow = r; });
    if (body.action === 'state.get') return json({ ok: true, data: view(body.token === 'tokB0000xyz' ? '小红' : '小明') });
    return json({ ok: true, data: null });
  });
  render(<AppProvider><Switcher /></AppProvider>);
  await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('小明'));
  fireEvent.click(screen.getByRole('button', { name: '慢请求' }));
  fireEvent.click(screen.getByRole('button', { name: '换人' }));
  expect(screen.getByTestId('name').textContent).toBe('小红');
  slow(json({ ok: true, data: view('小明的数据') }));
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.getByTestId('name').textContent).toBe('小红');
  expect(JSON.parse(localStorage.getItem('pk.view.tokB0000')).me.name).toBe('小红');
});

test('refreshes when the page comes back into view', async () => {
  loggedIn('tokA0000xyz', view('小明'));
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true, data: view('小明') }));
  render(<App />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});

test('a server error on first load offers a retry', async () => {
  loggedIn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ message: 'Error in workflow' }, 500));
  render(<App />);
  expect(await screen.findByRole('button', { name: '再试一次' })).toBeTruthy();
});
