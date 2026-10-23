// Turns PushPlus's reply ({code, msg}) into the API response the 「发一条试试」 button shows.
const REASONS = {
  905: '代发推送的账号还没在 PushPlus 做实名认证（个人中心 → 个人资料 → 实名认证），做完再试',
  903: 'PushPlus 说这个 token 不对，检查一下有没有复制完整',
  900: 'PushPlus 暂时限制了这个账号发消息，通常过 1–2 天恢复',
  888: 'PushPlus 账号积分不够，发不出去',
};

export function pushResult(reply) {
  if (reply && Number(reply.code) === 200) return { status: 200, body: { ok: true, data: { message: '发出去了，看看微信' } } };
  const message = !reply
    ? 'PushPlus 没有回应，稍后再试'
    : REASONS[reply.code] ?? `PushPlus 没发出去：${reply.msg || reply.data || `错误码 ${reply.code}`}`;
  return { status: 502, body: { ok: false, error: { code: 'UPSTREAM', message } } };
}
