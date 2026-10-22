import { builders, connect, workflow } from '../lib/nodes.mjs';

export const AUTH_ID = 'pkAuth0000000001';

const CHECK = `
const input = $('收到调用').first().json;
const token = String(input.token ?? input.body?.token ?? '');
const state = PK.stateFromTables({
  pk_sessions: $('读取 pk_sessions').all().map((i) => i.json),
  pk_users: $('读取 pk_users').all().map((i) => i.json),
});
const me = PK.authenticate(state, token, new Date().toISOString());
return [{ json: me
  ? { ok: true, me: { uid: me.uid, name: me.name, role: me.role } }
  : { ok: false, status: 401, body: { ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } } } }];
`;

export default function auth({ core, cfg }) {
  const B = builders({ workflowId: AUTH_ID, core, cfg });
  const nodes = [
    B.sticky('## 登录校验（子流程）\n收到调用方传来的 token，查会话表和用户表，告诉调用方「这是谁」或「没登录」。\n点餐接口、导入菜谱、小票入库都复用它。', [0, -1.4], [4, 1.2]),
    B.execTrigger('收到调用', [0, 0]),
    B.dtGetAll('pk_sessions', [1, 0]),
    B.dtGetAll('pk_users', [2, 0]),
    B.code('核对会话', CHECK, [3, 0], { withCore: true }),
  ];
  const connections = connect(
    ['收到调用', '读取 pk_sessions'],
    ['读取 pk_sessions', '读取 pk_users'],
    ['读取 pk_users', '核对会话'],
  );
  return workflow({ id: AUTH_ID, name: '搭伙小灶 · 登录校验', nodes, connections, cfg, secret: true });
}
