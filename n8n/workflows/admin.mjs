import { builders, connect, workflow } from '../lib/nodes.mjs';
import { TABLES } from '../../core/schema.js';
import { HANDLE, PICK } from './api.mjs';

export const ADMIN_ID = 'pkAdmin000000001';

// Same pipeline as the public API, but only reachable on the server itself and allowed to run `internal` actions.
export default function admin({ core, cfg }) {
  const B = builders({ workflowId: ADMIN_ID, core, cfg });
  const tables = Object.keys(TABLES);
  const nodes = [
    B.sticky('## 管理接口\n只在服务器本机调用（`scripts/server.sh reset-pin`），比如帮忘了口令的人重置。\n公网访问不到，网页上的接口也不能调用这里的操作。', [0, -1.4], [5, 1.2]),
    B.webhook('收到请求', 'pk-admin', [0, 0]),
    B.cryptoRand('生成随机数', [1, 0]),
    ...tables.map((t, i) => B.dtGetAll(t, [2 + i, 0])),
    B.code('业务处理', HANDLE(cfg.timezone, true), [9, 0], { withCore: true }),
    ...tables.flatMap((t, i) => [B.code(`挑出 ${t} 的改动`, PICK(t), [10, 1 + i]), B.dtUpsert(t, [11, 1 + i])]),
    B.respond('回复', { fromNode: '业务处理' }, [10, 2 + tables.length]),
  ];
  const connections = connect(
    ['收到请求', '生成随机数'],
    ['生成随机数', `读取 ${tables[0]}`],
    ...tables.slice(1).map((t, i) => [`读取 ${tables[i]}`, `读取 ${t}`]),
    [`读取 ${tables.at(-1)}`, '业务处理'],
    ...tables.flatMap((t) => [['业务处理', `挑出 ${t} 的改动`], [`挑出 ${t} 的改动`, `写入 ${t}`]]),
    ['业务处理', '回复'],
  );
  return workflow({ id: ADMIN_ID, name: '饭搭子 · 管理接口', nodes, connections, cfg, secret: true });
}
