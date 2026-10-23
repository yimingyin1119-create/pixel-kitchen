import { test, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { Me } from './Me.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

const view = () => makeView('member', {
  me: { uid: 'd1', name: '小明', role: 'member', avatar: '', hasPush: false },
  users: [{ uid: 'c1', name: '小红', role: 'member' }, { uid: 'd1', name: '小明', role: 'member' }],
});

test('test push button calls me.testPush', () => {
  const { act } = renderWithApp(<Me />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '发一条试试' }));
  expect(act).toHaveBeenCalledWith('me.testPush', {});
});

test('test push button disabled while sending', () => {
  renderWithApp(<Me />, { view: view(), act: vi.fn(() => new Promise(() => {})) });
  const btn = screen.getByRole('button', { name: '发一条试试' });
  fireEvent.click(btn);
  expect(screen.getByRole('button', { name: '发送中…' }).disabled).toBe(true);
});

test('saving the push token calls me.update', () => {
  const { act } = renderWithApp(<Me />, { view: view() });
  fireEvent.input(screen.getByLabelText('PushPlus token'), { target: { value: ' abc123 ' } });
  fireEvent.click(screen.getByRole('button', { name: '保存 token' }));
  expect(act).toHaveBeenCalledWith('me.update', { pushToken: 'abc123' });
});

test('members are listed without roles', () => {
  renderWithApp(<Me />, { view: view() });
  expect(screen.getByText('小红、小明')).toBeTruthy();
  expect(screen.queryByText(/厨师/)).toBe(null);
});

test('pin resets are not offered in the app', () => {
  renderWithApp(<Me />, { view: view() });
  expect(screen.queryByRole('button', { name: '重置口令' })).toBe(null);
  expect(screen.getByText(/忘了口令/)).toBeTruthy();
});

test('sign out', () => {
  const { getByRole } = renderWithApp(<Me />, { view: view() });
  fireEvent.click(getByRole('button', { name: '退出登录' }));
});

test('meal history is one tap away', () => {
  renderWithApp(<Me />, { view: view() });
  fireEvent.click(screen.getByRole('button', { name: '吃饭记录' }));
  expect(window.location.hash).toBe('#/history');
});

test('test push shows what PushPlus answered', async () => {
  renderWithApp(<Me />, { view: view(), act: vi.fn().mockResolvedValue({ message: '发出去了，看看微信' }) });
  fireEvent.click(screen.getByRole('button', { name: '发一条试试' }));
  expect(await screen.findByText('发出去了，看看微信')).toBeTruthy();
});

test('test push failure shows the reason', async () => {
  const { ApiError } = await import('../api.js');
  const act = vi.fn().mockRejectedValue(new ApiError('UPSTREAM', '代发推送的账号还没在 PushPlus 做实名认证', 502));
  renderWithApp(<Me />, { view: view(), act });
  fireEvent.click(screen.getByRole('button', { name: '发一条试试' }));
  expect(await screen.findByText(/还没在 PushPlus 做实名认证/)).toBeTruthy();
});

test('the guide explains the one-sender setup', () => {
  renderWithApp(<Me />, { view: view() });
  expect(screen.getAllByText(/好友二维码/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/好友令牌/).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: /好友消息/ }).getAttribute('href')).toBe('https://www.pushplus.plus/liaison.html');
});
