import { builders, connect, workflow } from '../lib/nodes.mjs';
import { TABLES } from '../../core/schema.js';

export const SETUP_ID = 'pkSetup000000001';
// Not under /webhook/pk/, so the public proxy never forwards it; deploy scripts call it on localhost.
export const SETUP_PATH = 'pk-setup';

export default function setup({ core, cfg }) {
  const B = builders({ workflowId: SETUP_ID, core, cfg });
  const tables = Object.entries(TABLES);
  const nodes = [
    B.sticky('## 建表\n部署脚本在服务器本机调用一次，把 7 张数据表建好；表已存在就跳过，不会清数据。\n这个地址不对公网开放。', [0, -1.4], [4, 1.2]),
    B.webhook('开始建表', SETUP_PATH, [0, 0]),
    ...tables.map(([t, cols], i) => B.dtCreate(t, cols, [1 + i, 0])),
    B.respond('建好了', { status: 200 }, [1 + tables.length, 0]),
  ];
  const last = nodes.at(-1);
  last.parameters.responseBody = '={{ { ok: true } }}';
  const connections = connect(
    ['开始建表', `建表 ${tables[0][0]}`],
    ...tables.slice(1).map(([t], i) => [`建表 ${tables[i][0]}`, `建表 ${t}`]),
    [`建表 ${tables.at(-1)[0]}`, '建好了'],
  );
  return workflow({ id: SETUP_ID, name: '饭搭子 · 建表', nodes, connections, cfg });
}
