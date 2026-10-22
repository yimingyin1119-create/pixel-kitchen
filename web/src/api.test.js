import { test, expect, vi } from 'vitest';
import { getApiBase, call, OfflineError, ApiError } from './api.js';

test('api base override in dev is persisted and stripped from the address bar', () => {
  window.history.replaceState(null, '', '/pixel-kitchen/?api=https://dev.example&x=1#/order');
  expect(getApiBase()).toBe('https://dev.example');
  expect(window.location.search).toBe('?x=1');
  expect(window.location.hash).toBe('#/order');
  window.history.replaceState(null, '', '/pixel-kitchen/');
  expect(getApiBase()).toBe('https://dev.example');
});

test('call posts action, token and payload', async () => {
  window.history.replaceState(null, '', '/?api=https://api.test');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { hi: 1 } })));
  expect(await call('state.get', {}, 'tok')).toEqual({ hi: 1 });
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('https://api.test/webhook/pk/api');
  expect(JSON.parse(init.body)).toEqual({ action: 'state.get', token: 'tok', payload: {} });
});

test('network failure is an OfflineError', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(call('state.get', {}, 't')).rejects.toBeInstanceOf(OfflineError);
});

test('error body becomes an ApiError with code and message', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }), { status: 401 }),
  );
  const err = await call('state.get', {}, 't').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect([err.code, err.message, err.status]).toEqual(['UNAUTHORIZED', '请先登录', 401]);
});
