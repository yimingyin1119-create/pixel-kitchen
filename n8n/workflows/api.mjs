import { builders, connect, workflow } from '../lib/nodes.mjs';
import { TABLES } from '../../core/schema.js';
import { AUTH_ID } from './auth.mjs';
import { NOTIFY_ID, PUSH_BODY, MESSAGES } from './notify.mjs';

export const API_ID = 'pkApi00000000001';

export const HANDLE = (tz, internal = false) => `
const req = $('收到请求').first().json.body ?? {};
const tables = {};
for (const t of Object.keys(PK.TABLES)) tables[t] = $('读取 ' + t).all().map((i) => i.json);
const ctx = {
  now: new Date().toISOString(), rand: $('生成随机数').first().json.rand, tz: '${tz}', seq: 0,
  token: String(req.token ?? ''),${internal ? ' internal: true,' : ''}
};
const r = PK.handle(String(req.action ?? ''), PK.stateFromTables(tables), req.payload ?? {}, ctx);
const writes = {};
for (const [t, rows] of Object.entries(r.writes)) writes[t] = rows.map((row) => PK.serialize(t, row));
return [{ json: { status: r.status, body: r.body, writes, events: r.events } }];
`;

export const PICK = (t) => `return ($('业务处理').first().json.writes['${t}'] ?? []).map((json) => ({ json }));`;
// The test push is sent inline (below) so the page can show PushPlus's real answer.
const EVENTS = `return ($('业务处理').first().json.events ?? []).filter((e) => e.type !== 'push.test').map((json) => ({ json }));`;
const TEST_PUSH = (title, content) => `
const ev = $('业务处理').first().json.events.find((e) => e.type === 'push.test');
return [{ json: { to: ev.to, title: ${JSON.stringify(title)}, content: ${JSON.stringify(content)} } }];
`;
const PUSH_REPLY = `
const r = $input.first().json;
return [{ json: PK.pushResult(r && r.code !== undefined ? r : null) }];
`;

// Title and content of the test push, taken from the notify workflow's copy so both stay identical.
function testCopy() {
  const [, , title, content] = MESSAGES.find(([type]) => type === 'push.test');
  return [title.replace(/^=/, ''), content.replace(/^=/, '')];
}

export default function api({ core, cfg }) {
  const B = builders({ workflowId: API_ID, core, cfg });
  const tables = Object.keys(TABLES);
  const nodes = [
    B.sticky('## 点餐接口\n网页上的每个按钮都打到这里：先确认是谁，再把 7 张表读出来交给「业务处理」（规则写在 core/，有测试），最后把改动写回、把通知交给通知中心。\n同一时间只处理一个请求，避免两个人的改动互相覆盖。', [0, -1.6], [6, 1.4]),
    B.webhook('收到请求', 'pk/api', [0, 0]),
    B.cryptoRand('生成随机数', [1, 0]),
    B.ifTrue('是登录类操作？', "={{ ['auth.register', 'auth.login'].includes($('收到请求').first().json.body?.action) }}", [2, 0]),
    B.execWorkflow('登录校验', AUTH_ID, { wait: true }, [3, 1]),
    B.ifTrue('登录有效？', '={{ $json.ok }}', [4, 1]),
    B.respond('回复：请先登录', { status: 401 }, [5, 2.2]),
    ...tables.map((t, i) => B.dtGetAll(t, [5 + i, 0])),
    B.code('业务处理', HANDLE(cfg.timezone), [12, 0], { withCore: true }),
    B.sticky('### 写回改动\n每张表一条支路，按从上到下的顺序执行，全部写完才回复网页。', [13, 0.6], [2, 1]),
    ...tables.flatMap((t, i) => [B.code(`挑出 ${t} 的改动`, PICK(t), [13, 1.6 + i]), B.dtUpsert(t, [14, 1.6 + i])]),
    B.code('拆出通知', EVENTS, [13, 1.6 + tables.length]),
    B.execWorkflow('交给通知中心', NOTIFY_ID, { wait: false }, [14, 1.6 + tables.length]),
    B.ifTrue('是测试推送？', "={{ ($('业务处理').first().json.events ?? []).some((e) => e.type === 'push.test') }}", [13, 2.8 + tables.length]),
    B.code('拼测试推送', TEST_PUSH(...testCopy()), [14, 2.8 + tables.length]),
    B.httpPostJson('试发一条', cfg.pushplusUrl, PUSH_BODY, [15, 2.8 + tables.length], { continueOnError: true }),
    B.code('看推送结果', PUSH_REPLY, [16, 2.8 + tables.length], { withCore: true }),
    B.respond('回复：推送结果', {}, [17, 2.8 + tables.length]),
    B.respond('回复网页', { fromNode: '业务处理' }, [14, 4 + tables.length]),
  ];
  const connections = connect(
    ['收到请求', '生成随机数'],
    ['生成随机数', '是登录类操作？'],
    ['是登录类操作？', `读取 ${tables[0]}`, 0],
    ['是登录类操作？', '登录校验', 1],
    ['登录校验', '登录有效？'],
    ['登录有效？', `读取 ${tables[0]}`, 0],
    ['登录有效？', '回复：请先登录', 1],
    ...tables.slice(1).map((t, i) => [`读取 ${tables[i]}`, `读取 ${t}`]),
    [`读取 ${tables.at(-1)}`, '业务处理'],
    ...tables.flatMap((t) => [['业务处理', `挑出 ${t} 的改动`], [`挑出 ${t} 的改动`, `写入 ${t}`]]),
    ['业务处理', '拆出通知'],
    ['拆出通知', '交给通知中心'],
    ['业务处理', '是测试推送？'],
    ['是测试推送？', '拼测试推送', 0],
    ['是测试推送？', '回复网页', 1],
    ['拼测试推送', '试发一条'],
    ['试发一条', '看推送结果'],
    ['看推送结果', '回复：推送结果'],
  );
  return workflow({ id: API_ID, name: '搭伙小灶 · 点餐接口', nodes, connections, cfg, secret: true });
}
