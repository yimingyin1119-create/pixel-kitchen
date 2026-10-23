import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushResult } from './push.js';

test('a delivered push is ok', () => {
  assert.deepEqual(pushResult({ code: 200, msg: '请求成功' }), { status: 200, body: { ok: true, data: { message: '发出去了，看看微信' } } });
});

test('unverified sender explains real-name verification', () => {
  const r = pushResult({ code: 905, msg: '账户未进行实名认证' });
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, 'UPSTREAM');
  assert.match(r.body.error.message, /实名认证/);
});

test('wrong token and blocked account are explained', () => {
  assert.match(pushResult({ code: 903 }).body.error.message, /token/);
  assert.match(pushResult({ code: 900 }).body.error.message, /限制/);
});

test('unknown failures pass PushPlus wording through', () => {
  assert.match(pushResult({ code: 999, msg: '好友令牌不存在' }).body.error.message, /好友令牌不存在/);
  assert.match(pushResult(null).body.error.message, /PushPlus 没有回应/);
});
