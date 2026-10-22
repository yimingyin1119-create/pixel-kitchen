import { test, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { Me } from './Me.jsx';
import { renderWithApp, makeView } from '../test-utils.jsx';

test('test push button calls me.testPush', () => {
  const { act } = renderWithApp(<Me />);
  fireEvent.click(screen.getByRole('button', { name: '发一条试试' }));
  expect(act).toHaveBeenCalledWith('me.testPush', {});
});

test('saving the push token calls me.update', () => {
  const { act } = renderWithApp(<Me />);
  fireEvent.input(screen.getByLabelText('PushPlus token'), { target: { value: ' abc123 ' } });
  fireEvent.click(screen.getByRole('button', { name: '保存 token' }));
  expect(act).toHaveBeenCalledWith('me.update', { pushToken: 'abc123' });
});

test('chef adds a member', async () => {
  const { act } = renderWithApp(<Me />, { view: makeView('chef') });
  fireEvent.input(screen.getByLabelText('成员名字'), { target: { value: '小红' } });
  fireEvent.input(screen.getByLabelText('4 位口令'), { target: { value: '2468' } });
  fireEvent.click(screen.getByRole('button', { name: '添加成员' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('users.create', { name: '小红', pin: '2468' }));
});

test('diner cannot add members', () => {
  renderWithApp(<Me />);
  expect(screen.queryByRole('button', { name: '添加成员' })).toBe(null);
});
