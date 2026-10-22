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

test('reset pin for a member', async () => {
  const { act } = renderWithApp(<Me />, { view: view() });
  fireEvent.change(screen.getByLabelText('帮谁重置'), { target: { value: 'c1' } });
  fireEvent.input(screen.getByLabelText('新口令'), { target: { value: '1357' } });
  fireEvent.click(screen.getByRole('button', { name: '重置口令' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('users.resetPin', { uid: 'c1', pin: '1357' }));
});

test('sign out', () => {
  const { getByRole } = renderWithApp(<Me />, { view: view() });
  fireEvent.click(getByRole('button', { name: '退出登录' }));
});
